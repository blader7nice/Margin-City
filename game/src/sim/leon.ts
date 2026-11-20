import { approach, clamp, overlaps } from './geom';
import type { AABB, HideSpot, InputState, LeonState, NoiseEvent, SimEvent, Solid } from './types';

export const LEON = {
  halfW: 0.25,
  hStand: 1.7,
  hCrouch: 1.1,
  walk: 3.0,
  run: 5.4,
  crouch: 1.5,
  accelGround: 30,
  decelGround: 36,
  accelAir: 13,
  jumpV: 7.6,
  gravity: 24,
  maxFall: 22,
  coyote: 0.1,
  jumpBuffer: 0.13,
  mantleTime: 0.44,
  hideEnter: 0.35,
  hideExit: 0.3,
  stepRun: 0.3,
  stepWalk: 0.46,
  stepCrouch: 0.62,
  noiseRun: 7.5,
  noiseWalk: 2.0,
  landNoiseSpeed: 6.8,
  hSlide: 0.9,
  slideTime: 0.55,
  slideMinSpeed: 4.6,
  pushSpeed: 1.6,
};

export interface Pushable {
  box(): AABB;
  /** Try to move by dx; returns the distance actually moved. */
  push(dx: number): number;
  /** Can be pushed right now (resting on something, not locked). */
  canPush(): boolean;
}

export interface SlowZone extends AABB {
  mul: number;
}

export function createLeon(x: number, y: number): LeonState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    crouching: false,
    running: false,
    height: LEON.hStand,
    mode: 'normal',
    modeT: 0,
    hideId: null,
    coyote: 0,
    jumpBuffer: 0,
    stepTimer: 0,
    mantleFrom: { x, y },
    mantleTo: { x, y },
    lastLandingSpeed: 0,
    airTime: 0,
    light: 0,
    exposure: 0,
    pushing: false,
    slideT: 0,
  };
}

export function leonBox(l: LeonState, x = l.x, y = l.y, h = l.height): AABB {
  return { x0: x - LEON.halfW, x1: x + LEON.halfW, y0: y, y1: y + h };
}

function collidable(s: Solid): boolean {
  return !s.noCollide && !s.cartOnly;
}

function blocked(box: AABB, solids: Solid[], ignoreOneWay = true): Solid | null {
  for (const s of solids) {
    if (!collidable(s)) continue;
    if (s.oneWay && ignoreOneWay) continue;
    if (overlaps(box, s, 1e-4)) return s;
  }
  return null;
}

export interface LeonContext {
  solids: Solid[];
  hideSpots: HideSpot[];
  input: InputState;
  jumpPressed: boolean;
  jumpReleased: boolean;
  interactPressed: boolean;
  events: SimEvent[];
  noises: NoiseEvent[];
  dropThrough: { t: number };
  pushables?: Pushable[];
  slowZones?: SlowZone[];
  /** Below this y Leon is in the low service duct: crouch automatically. */
  ductY?: number;
  /** Set when Leon used the interact press (hide), so the world does not reuse it. */
  interactConsumed?: { v: boolean };
}

/** Advance Leon by dt. Pure function of state + context (mutates state, appends events). */
export function updateLeon(l: LeonState, dt: number, c: LeonContext): void {
  l.modeT += dt;
  switch (l.mode) {
    case 'mantle':
      updateMantle(l, c);
      return;
    case 'enterHide':
      l.vx = 0;
      if (l.modeT >= LEON.hideEnter) setMode(l, 'hidden');
      return;
    case 'hidden':
      l.vx = 0;
      if (c.interactPressed || c.jumpPressed) {
        setMode(l, 'exitHide');
        c.events.push({ type: 'unhide', id: l.hideId ?? '' });
      }
      return;
    case 'exitHide':
      if (l.modeT >= LEON.hideExit) {
        l.hideId = null;
        setMode(l, 'normal');
      }
      return;
    case 'caught':
    case 'cutscene':
    case 'finished':
      l.vx = approach(l.vx, 0, LEON.decelGround * dt);
      applyGravityAndCollide(l, dt, c);
      return;
    case 'normal':
      updateNormal(l, dt, c);
      return;
  }
}

function setMode(l: LeonState, m: LeonState['mode']): void {
  l.mode = m;
  l.modeT = 0;
}

function updateNormal(l: LeonState, dt: number, c: LeonContext): void {
  const inp = c.input;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir !== 0 && l.slideT <= 0) l.facing = dir > 0 ? 1 : -1;
  l.pushing = false;

  // Drop through a one-way platform (S + Space) — handled before crouching, which S also triggers.
  if (c.jumpPressed && inp.down && l.grounded && standingOnOneWay(l, c.solids)) {
    c.dropThrough.t = 0.38;
    l.grounded = false;
    l.coyote = 0;
    l.jumpBuffer = 0;
    l.crouching = false;
    l.height = LEON.hStand;
    applyGravityAndCollide(l, dt, c);
    return;
  }

  // Crouch (cannot stand up under a low ceiling such as the shutter). Running + crouch = slide.
  const inDuct = c.ductY !== undefined && l.y < c.ductY + 0.6;
  const wantCrouch = inp.crouch || (inp.down && l.grounded) || (inDuct && ductNeedsCrouch(l, dir, c));
  if (l.slideT > 0) {
    l.slideT -= dt;
    if (l.slideT <= 0) {
      l.slideT = 0;
      l.crouching = true;
    }
  } else if (wantCrouch && l.grounded) {
    if (!l.crouching && Math.abs(l.vx) >= LEON.slideMinSpeed && inp.crouch) {
      l.slideT = LEON.slideTime;
      c.events.push({ type: 'slide' });
    }
    l.crouching = true;
  } else if (l.crouching) {
    const standBox = leonBox(l, l.x, l.y, LEON.hStand);
    if (!blocked(standBox, c.solids)) l.crouching = false;
  }
  if (l.crouching && !wantCrouch && l.slideT <= 0) {
    const standBox = leonBox(l, l.x, l.y, LEON.hStand);
    if (!blocked(standBox, c.solids)) l.crouching = false;
  }
  l.height = l.slideT > 0 ? LEON.hSlide : l.crouching ? LEON.hCrouch : LEON.hStand;
  l.running = inp.run && !l.crouching && dir !== 0;

  // Interactions first: hide.
  if (c.interactPressed && l.grounded) {
    const spot = c.hideSpots.find((s) => Math.abs(s.x - l.x) <= s.reach && Math.abs(s.y - l.y) < 0.4);
    if (spot) {
      if (c.interactConsumed) c.interactConsumed.v = true;
      l.hideId = spot.id;
      l.crouching = false;
      l.slideT = 0;
      l.height = LEON.hStand;
      setMode(l, 'enterHide');
      c.events.push({ type: 'hide', id: spot.id });
      return;
    }
  }

  let maxSpeed = l.crouching ? LEON.crouch : l.running ? LEON.run : LEON.walk;
  if (c.slowZones && l.grounded) {
    for (const z of c.slowZones) if (l.x > z.x0 && l.x < z.x1 && l.y >= z.y0 - 0.05 && l.y <= z.y1) maxSpeed *= z.mul;
  }
  if (l.slideT > 0) {
    // Slide: keeps momentum, no steering, decays toward crouch speed.
    const k = l.slideT / LEON.slideTime;
    l.vx = l.facing * (LEON.crouch + (LEON.run - LEON.crouch) * k);
  } else {
    const target = dir * maxSpeed;
    const accel = l.grounded ? (dir !== 0 ? LEON.accelGround : LEON.decelGround) : LEON.accelAir;
    l.vx = approach(l.vx, target, accel * dt);
  }

  // Pushing a heavy object (the ledger cart): slow, deliberate, only on the ground.
  if (l.grounded && dir !== 0 && c.pushables && l.slideT <= 0) {
    for (const p of c.pushables) {
      const b = p.box();
      const front = l.x + dir * LEON.halfW;
      const gap = dir > 0 ? b.x0 - front : front - b.x1;
      const vOverlap = l.y < b.y1 - 0.15 && l.y + l.height > b.y0 + 0.1;
      if (gap > -0.02 && gap < 0.08 && vOverlap && p.canPush()) {
        const speed = Math.min(Math.abs(l.vx), LEON.pushSpeed);
        const moved = p.push(dir * Math.max(speed, 0.6) * dt);
        l.vx = dir * (Math.abs(moved) / dt);
        l.pushing = true;
        if (Math.abs(moved) > 1e-5) c.events.push({ type: 'push', x: b.x0 });
      }
    }
  }

  // Jump with coyote time + input buffer + variable height.
  l.coyote = l.grounded ? LEON.coyote : Math.max(0, l.coyote - dt);
  l.jumpBuffer = c.jumpPressed ? LEON.jumpBuffer : Math.max(0, l.jumpBuffer - dt);
  if (l.jumpBuffer > 0 && l.coyote > 0 && !l.crouching && l.slideT <= 0) {
    l.vy = LEON.jumpV;
    c.events.push({ type: 'jump' });
    l.jumpBuffer = 0;
    l.coyote = 0;
    l.grounded = false;
  }
  if (c.jumpReleased && l.vy > 2.5) l.vy *= 0.55;

  applyGravityAndCollide(l, dt, c);

  if (!l.grounded && l.mode === 'normal') tryMantle(l, dir, c);

  // Footsteps → noise.
  if (l.grounded && Math.abs(l.vx) > 0.5 && l.mode === 'normal') {
    l.stepTimer -= dt;
    if (l.stepTimer <= 0) {
      const run = l.running && Math.abs(l.vx) > LEON.walk + 0.3;
      l.stepTimer = l.crouching ? LEON.stepCrouch : run ? LEON.stepRun : LEON.stepWalk;
      c.events.push({ type: 'step', who: 'leon', x: l.x, run });
      const radius = l.crouching ? 0 : run ? LEON.noiseRun : LEON.noiseWalk;
      if (radius > 0) {
        c.noises.push({ x: l.x, y: l.y + 0.2, radius, source: run ? 'run' : 'walk' });
        if (run) c.events.push({ type: 'noise', x: l.x, y: l.y + 0.2, radius, source: 'run' });
      }
    }
  } else {
    l.stepTimer = Math.min(l.stepTimer, 0.08);
  }
}

/** In the duct: crouch if standing up here or one step ahead would hit the ceiling. */
function ductNeedsCrouch(l: LeonState, dir: number, c: LeonContext): boolean {
  const here = leonBox(l, l.x, l.y + 0.01, LEON.hStand);
  const ahead = leonBox(l, l.x + dir * 0.35, l.y + 0.01, LEON.hStand);
  return !!blocked(here, c.solids) || (dir !== 0 && !!blocked(ahead, c.solids));
}

function standingOnOneWay(l: LeonState, solids: Solid[]): boolean {
  const probe = leonBox(l, l.x, l.y - 0.05, 0.05);
  return solids.some((s) => s.oneWay && overlaps(probe, s, 1e-4));
}

function applyGravityAndCollide(l: LeonState, dt: number, c: LeonContext): void {
  const wasGrounded = l.grounded;
  const prevY = l.y;
  c.dropThrough.t = Math.max(0, c.dropThrough.t - dt);

  // Horizontal move.
  let nx = l.x + l.vx * dt;
  let box = leonBox(l, nx, l.y);
  for (const s of c.solids) {
    if (!collidable(s) || s.oneWay) continue;
    if (!overlaps(box, s, 1e-4)) continue;
    if (l.vx > 0) nx = s.x0 - LEON.halfW;
    else if (l.vx < 0) nx = s.x1 + LEON.halfW;
    l.vx = 0;
    box = leonBox(l, nx, l.y);
  }
  l.x = nx;

  // Vertical move.
  l.vy = Math.max(l.vy - LEON.gravity * dt, -LEON.maxFall);
  let ny = l.y + l.vy * dt;
  let landed = false;
  box = leonBox(l, l.x, ny);
  for (const s of c.solids) {
    if (!collidable(s)) continue;
    if (!overlaps(box, s, 1e-4)) continue;
    if (s.oneWay) {
      if (c.dropThrough.t > 0) continue;
      if (l.vy <= 0 && prevY >= s.y1 - 0.02) {
        ny = s.y1;
        landed = true;
      }
      continue;
    }
    if (l.vy <= 0 && prevY >= s.y1 - 0.05) {
      ny = s.y1;
      landed = true;
    } else if (l.vy > 0) {
      ny = s.y0 - l.height;
      l.vy = 0;
    }
    box = leonBox(l, l.x, ny);
  }
  const fallSpeed = -l.vy;
  l.y = ny;
  if (landed) {
    l.vy = 0;
    l.grounded = true;
  } else {
    // Ground probe (walking off edges vs standing still on a surface).
    const probe = leonBox(l, l.x, l.y - 0.04, 0.04);
    l.grounded =
      l.vy <= 0 &&
      c.solids.some(
        (s) =>
          collidable(s) &&
          overlaps(probe, s, 1e-4) &&
          Math.abs(s.y1 - l.y) < 0.05 &&
          !(s.oneWay && c.dropThrough.t > 0),
      );
    if (l.grounded) l.vy = 0;
  }

  if (!l.grounded) l.airTime += dt;
  if (l.grounded && !wasGrounded) {
    l.lastLandingSpeed = landed ? fallSpeed : 0;
    if (l.airTime > 0.08) c.events.push({ type: 'land', speed: l.lastLandingSpeed });
    if (l.lastLandingSpeed > LEON.landNoiseSpeed) {
      const radius = clamp(4 + (l.lastLandingSpeed - LEON.landNoiseSpeed) * 1.2, 4, 9);
      c.noises.push({ x: l.x, y: l.y + 0.2, radius, source: 'land' });
      c.events.push({ type: 'noise', x: l.x, y: l.y + 0.2, radius, source: 'land' });
    }
    l.airTime = 0;
  }
}

function tryMantle(l: LeonState, dir: number, c: LeonContext): void {
  const f = l.facing;
  const pushing = dir === f || Math.sign(l.vx) === f;
  if (!pushing || l.crouching) return;
  // Right after dropping through a platform Leon must not grab the edge he just left.
  if (c.dropThrough.t > 0) return;
  const front = l.x + f * LEON.halfW;
  for (const s of c.solids) {
    if (!collidable(s)) continue;
    if (s.oneWay && c.dropThrough.t > 0) continue;
    const edge = f > 0 ? s.x0 : s.x1;
    const dEdge = (edge - front) * f;
    const minD = s.oneWay ? -0.45 : -0.06;
    if (dEdge < minD || dEdge > 0.36) continue;
    const rel = s.y1 - l.y;
    if (rel < 0.35 || rel > 2.1) continue;
    if (l.vy > 4.5 && rel > 1.4) continue; // still rising fast: wait for the hands to reach
    const tx = edge + f * (LEON.halfW + 0.12);
    const target = leonBox(l, tx, s.y1 + 0.01, LEON.hStand);
    if (blocked(target, c.solids)) continue;
    l.mantleFrom = { x: l.x, y: l.y };
    l.mantleTo = { x: tx, y: s.y1 };
    l.vx = 0;
    l.vy = 0;
    setMode(l, 'mantle');
    c.events.push({ type: 'mantle' });
    return;
  }
}

function updateMantle(l: LeonState, c: LeonContext): void {
  const t = clamp(l.modeT / LEON.mantleTime, 0, 1);
  const up = clamp(t / 0.62, 0, 1);
  const fwd = clamp((t - 0.45) / 0.55, 0, 1);
  const ease = (v: number) => v * v * (3 - 2 * v);
  l.y = l.mantleFrom.y + (l.mantleTo.y - l.mantleFrom.y) * ease(up);
  l.x = l.mantleFrom.x + (l.mantleTo.x - l.mantleFrom.x) * ease(fwd);
  if (t >= 1) {
    l.x = l.mantleTo.x;
    l.y = l.mantleTo.y;
    l.grounded = true;
    l.airTime = 0;
    setMode(l, 'normal');
  }
  void c;
}
