import { approach, clamp, segmentHitsBox } from './geom';
import type { GuardMode, GuardState, HideSpot, LeonState, NoiseEvent, SightSample, SimEvent, Solid } from './types';

/**
 * MM-01 — Corporate Warden.
 * Fairness rules (from the bible, enforced here and tested):
 *  - sees only inside his eye-light cone, within a light-dependent range, with clear line of sight;
 *  - never knows Leon's position without a stimulus: he goes to the last SEEN/HEARD position;
 *  - a hidden Leon is invisible unless MM-01 saw him enter that hiding place;
 *  - the only extra knowledge is the MIRROR forecast hotspot, which is visible to the player too.
 */
export const GUARD = {
  eyeY: 2.05,
  earY: 1.7,
  patrolSpeed: 1.45,
  suspiciousSpeed: 1.9,
  searchSpeed: 2.4,
  chaseSpeed: 4.3,
  returnSpeed: 1.8,
  baseRange: 4.0,
  lightRange: 8.5,
  crouchMul: 0.62,
  runMul: 1.15,
  coneUpDeg: 14,
  coneDownDeg: 38,
  nearSense: 1.25,
  catchDist: 0.95,
  catchMaxY: 2.6,
  suspicionDecay: 0.32,
  suspectAt: 0.3,
  chaseAt: 1.0,
  lookAroundTime: 3.2,
  inspectTime: 1.3,
  suspiciousTimeout: 6,
};

export interface GuardContext {
  leon: LeonState;
  solids: Solid[];
  hideSpots: HideSpot[];
  patrol: { x: number; pause: number }[];
  bounds: { x0: number; x1: number };
  forecastHotspot: HideSpot | null;
  noises: NoiseEvent[];
  events: SimEvent[];
  time: number;
  perceptionEnabled: boolean;
}

export function createGuard(x: number, facing: 1 | -1, patrolIndex: number): GuardState {
  return {
    x,
    y: 0,
    facing,
    lookDir: facing,
    mode: 'patrol',
    modeT: 0,
    suspicion: 0,
    lastKnown: null,
    patrolIndex,
    pauseT: 0,
    searchPhase: 'goto',
    forecastChecked: false,
    sawHideId: null,
    speed: 0,
    sight: { visible: false, range: 0, samples: [] },
    heardAt: null,
  };
}

/** Vision range for the current light/stance — exported for UI and tests. */
export function sightRange(leon: LeonState): number {
  const lightFactor = 0.25 + 0.75 * leon.light;
  let r = GUARD.baseRange + GUARD.lightRange * lightFactor;
  if (leon.crouching) r *= GUARD.crouchMul;
  else if (leon.running) r *= GUARD.runMul;
  return r;
}

export function computeSight(g: GuardState, leon: LeonState, solids: Solid[]): { visible: boolean; range: number; samples: SightSample[]; nearest: number } {
  const range = sightRange(leon);
  // While stepping INTO a hiding place Leon is still visible: being seen entering gives the spot away.
  const hidden = leon.mode === 'hidden';
  const ex = g.x;
  const ey = g.y + GUARD.eyeY;
  const h = leon.height;
  const pts = [
    { x: leon.x, y: leon.y + h - 0.15 },
    { x: leon.x, y: leon.y + h * 0.55 },
    { x: leon.x, y: leon.y + 0.25 },
  ];
  const samples: SightSample[] = [];
  let visible = false;
  let nearest = Infinity;
  const look = g.lookDir;
  for (const p of pts) {
    const dx = p.x - ex;
    const dy = p.y - ey;
    const dist = Math.hypot(dx, dy);
    const ahead = dx * look;
    let inCone = false;
    if (dist <= GUARD.nearSense && Math.abs(dy) < 2.2) {
      inCone = true; // senses someone right next to him, even slightly behind
    } else if (ahead > 0 && dist <= range) {
      const ang = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
      inCone = ang <= GUARD.coneUpDeg && ang >= -GUARD.coneDownDeg;
    }
    let isBlocked = false;
    if (inCone) {
      for (const s of solids) {
        if (s.occludes === false) continue;
        if (segmentHitsBox(ex, ey, p.x, p.y, s)) {
          isBlocked = true;
          break;
        }
      }
    }
    samples.push({ x: p.x, y: p.y, inCone, blocked: isBlocked });
    if (inCone && !isBlocked && !hidden) {
      visible = true;
      nearest = Math.min(nearest, dist);
    }
  }
  return { visible, range, samples, nearest };
}

function setMode(g: GuardState, m: GuardMode, ev: SimEvent[]): void {
  if (g.mode === m) return;
  ev.push({ type: 'guardMode', from: g.mode, to: m });
  g.mode = m;
  g.modeT = 0;
  if (m === 'search') {
    g.searchPhase = 'goto';
    g.forecastChecked = false;
  }
}

function moveToward(g: GuardState, tx: number, speed: number, dt: number, bounds: { x0: number; x1: number }): boolean {
  const target = clamp(tx, bounds.x0, bounds.x1);
  const d = target - g.x;
  if (Math.abs(d) > 0.05) {
    g.facing = d > 0 ? 1 : -1;
    g.lookDir = g.facing;
  }
  g.x = approach(g.x, target, speed * dt);
  g.speed = Math.abs(d) > 0.05 ? speed : 0;
  return Math.abs(target - g.x) < 0.06;
}

export interface GuardResult {
  caught: 'grabbed' | 'found' | null;
}

export function updateGuard(g: GuardState, dt: number, c: GuardContext): GuardResult {
  const ev = c.events;
  const leon = c.leon;
  g.modeT += dt;
  g.speed = 0;

  // --- Perception ---
  const sight = c.perceptionEnabled
    ? computeSight(g, leon, c.solids)
    : { visible: false, range: 0, samples: [], nearest: Infinity };
  g.sight = { visible: sight.visible, range: sight.range, samples: sight.samples };
  leon.exposure = sight.visible ? clamp(1 - sight.nearest / Math.max(sight.range, 0.01), 0.15, 1) : 0;

  if (sight.visible) {
    const closeness = clamp(1 - sight.nearest / sight.range, 0, 1);
    const gain = (0.85 + 2.8 * closeness) * (leon.running ? 1.35 : 1);
    g.suspicion = Math.min(1.2, g.suspicion + gain * dt);
    g.lastKnown = { x: leon.x, y: leon.y };
    if (leon.mode === 'enterHide' && leon.hideId) g.sawHideId = leon.hideId;
  } else if (g.mode !== 'chase') {
    g.suspicion = Math.max(0, g.suspicion - GUARD.suspicionDecay * dt);
  }
  // A Leon seen while entering a hiding place stays "known" there.
  if (leon.mode === 'enterHide' && sight.visible && leon.hideId) g.sawHideId = leon.hideId;
  if (leon.mode === 'normal') g.sawHideId = null;

  // Hearing: knows WHERE the noise came from, not where Leon is now.
  if (c.perceptionEnabled) {
    for (const n of c.noises) {
      const d = Math.hypot(n.x - g.x, n.y - (g.y + GUARD.earY));
      if (d > n.radius) continue;
      g.heardAt = { x: n.x, y: n.y, t: c.time };
      ev.push({ type: 'heard', x: n.x, y: n.y });
      if (g.mode === 'patrol' || g.mode === 'return') {
        g.lastKnown = { x: n.x, y: n.y };
        g.suspicion = Math.max(g.suspicion, GUARD.suspectAt + 0.05);
        setMode(g, 'suspicious', ev);
      } else if (g.mode === 'search' || g.mode === 'suspicious') {
        g.lastKnown = { x: n.x, y: n.y };
        if (g.mode === 'search') {
          g.searchPhase = 'goto';
          g.modeT = 0;
        }
      }
    }
  }

  if (g.suspicion >= GUARD.chaseAt && g.mode !== 'chase' && sight.visible) setMode(g, 'chase', ev);
  else if (g.suspicion >= GUARD.suspectAt && (g.mode === 'patrol' || g.mode === 'return')) setMode(g, 'suspicious', ev);

  // --- Behaviour ---
  switch (g.mode) {
    case 'patrol': {
      const wp = c.patrol[g.patrolIndex];
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        // Looks back over his shoulder during pauses: the cone sweeps, readable to the player.
        const phase = wp.pause - g.pauseT;
        g.lookDir = phase > wp.pause * 0.35 && phase < wp.pause * 0.8 ? ((-g.facing) as 1 | -1) : g.facing;
        if (g.pauseT <= 0) {
          g.patrolIndex = nextPatrolIndex(g, c.patrol.length);
          g.lookDir = g.facing;
        }
      } else if (moveToward(g, wp.x, GUARD.patrolSpeed, dt, c.bounds)) {
        g.pauseT = wp.pause;
      }
      break;
    }
    case 'suspicious': {
      // Turn toward the stimulus, hesitate, then walk to it.
      if (g.lastKnown) {
        const d = g.lastKnown.x - g.x;
        if (Math.abs(d) > 0.1) {
          g.facing = d > 0 ? 1 : -1;
          g.lookDir = g.facing;
        }
        if (g.modeT > 0.7) {
          const arrived = moveToward(g, g.lastKnown.x, GUARD.suspiciousSpeed, dt, c.bounds);
          if (arrived && !sight.visible) setMode(g, 'search', ev);
        }
      }
      if (g.modeT > GUARD.suspiciousTimeout && !sight.visible) setMode(g, 'search', ev);
      break;
    }
    case 'chase': {
      if (sight.visible) {
        moveToward(g, leon.x, GUARD.chaseSpeed, dt, c.bounds);
        const dx = Math.abs(leon.x - g.x);
        if (dx <= GUARD.catchDist && leon.y <= GUARD.catchMaxY && leon.mode !== 'hidden') {
          return { caught: 'grabbed' };
        }
      } else {
        // Lost sight: commit to the last seen spot, slightly beyond it in the travel direction.
        if (g.lastKnown) g.lastKnown = { x: g.lastKnown.x + g.facing * 1.5, y: g.lastKnown.y };
        g.suspicion = 0.85;
        setMode(g, 'search', ev);
      }
      break;
    }
    case 'search': {
      const res = updateSearch(g, dt, c);
      if (res) return { caught: res };
      break;
    }
    case 'return': {
      const wp = c.patrol[g.patrolIndex];
      if (moveToward(g, wp.x, GUARD.returnSpeed, dt, c.bounds)) {
        g.pauseT = wp.pause * 0.5;
        g.suspicion = 0;
        setMode(g, 'patrol', ev);
      }
      break;
    }
  }

  // Seen-entering-hide: go straight there and pull him out.
  if (g.sawHideId && leon.mode === 'hidden' && (g.mode === 'search' || g.mode === 'suspicious' || g.mode === 'chase')) {
    const spot = c.hideSpots.find((s) => s.id === g.sawHideId);
    if (spot) {
      g.lastKnown = { x: spot.x, y: spot.y };
      if (Math.abs(spot.x - g.x) < GUARD.catchDist + 0.2) return { caught: 'found' };
    }
  }
  return { caught: null };
}

function nextPatrolIndex(g: GuardState, n: number): number {
  // Ping-pong through the waypoints.
  const dir = g.facing;
  let next = g.patrolIndex + (dir > 0 ? 1 : -1);
  if (next >= n) next = n - 2;
  if (next < 0) next = 1;
  if (next !== g.patrolIndex) g.facing = next > g.patrolIndex ? 1 : -1;
  return next;
}

function updateSearch(g: GuardState, dt: number, c: GuardContext): 'found' | null {
  const ev = c.events;
  const leon = c.leon;
  switch (g.searchPhase) {
    case 'goto': {
      const target = g.lastKnown?.x ?? g.x;
      if (moveToward(g, target, GUARD.searchSpeed, dt, c.bounds)) {
        g.searchPhase = 'look';
        g.modeT = 0;
      }
      break;
    }
    case 'look': {
      // Look around: forward, back, forward.
      const t = g.modeT;
      g.lookDir = t < 1.1 ? g.facing : t < 2.3 ? ((-g.facing) as 1 | -1) : g.facing;
      if (t >= GUARD.lookAroundTime) {
        const hs = c.forecastHotspot;
        if (hs && !g.forecastChecked && Math.abs(hs.x - g.x) < 16) {
          g.searchPhase = 'forecast';
        } else {
          setMode(g, 'return', ev);
          g.patrolIndex = nearestPatrol(g, c.patrol);
        }
      }
      break;
    }
    case 'forecast': {
      const hs = c.forecastHotspot!;
      if (moveToward(g, hs.x, GUARD.searchSpeed, dt, c.bounds)) {
        g.searchPhase = 'inspect';
        g.modeT = 0;
      }
      break;
    }
    case 'inspect': {
      const hs = c.forecastHotspot!;
      g.facing = 1;
      g.lookDir = 1;
      if (g.modeT > GUARD.inspectTime * 0.6 && leon.mode === 'hidden' && leon.hideId === hs.id) return 'found';
      if (g.modeT >= GUARD.inspectTime) {
        g.forecastChecked = true;
        setMode(g, 'return', ev);
        g.patrolIndex = nearestPatrol(g, c.patrol);
      }
      break;
    }
  }
  return null;
}

function nearestPatrol(g: GuardState, patrol: { x: number }[]): number {
  let best = 0;
  for (let i = 1; i < patrol.length; i++) if (Math.abs(patrol[i].x - g.x) < Math.abs(patrol[best].x - g.x)) best = i;
  return best;
}
