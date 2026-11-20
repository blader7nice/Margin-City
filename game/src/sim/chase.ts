import { approach, clamp } from './geom';
import { CATWALK_Y, CHASE } from './level';
import type { GuardState, Lane, LeonState, SimEvent, Solid } from './types';

/**
 * Archive wing chase. MM-01 is NOT faster than a running Leon (4.4 vs 5.4 m/s): the threat comes from
 * prediction and cut-offs, every one of them telegraphed so the player can improvise.
 *
 *  - MIRROR route forecast: at the decision line it predicts Leon's lane and seals the gate on that lane
 *    (warning lights + text first). Counter: switch lane (drop / climb a stack) or slide under the closing gate.
 *  - MM-01 shadows Leon on the other lane and uses stairs to change level when Leon's predicted position is near.
 *  - Intercept: Leon on the floor → MM-01 takes the service passage and steps out ahead (door lights first);
 *    Leon on the catwalk → MM-01 waits at the predicted landing point under the catwalk end.
 *  - Third way: the service duct under the floor. MIRROR has no sensors there → "subject lost".
 */

export type GateStateName = 'open' | 'warn' | 'closing' | 'closed' | 'opening';
export interface GateState {
  id: string;
  lane: 'catwalk' | 'floor';
  x0: number;
  x1: number;
  closed: number;
  open: number;
  top: number;
  closeTime: number;
  state: GateStateName;
  t: number;
  bottom: number;
}

export type MmMode = 'inactive' | 'pursue' | 'stairs' | 'passage' | 'wait' | 'blocked' | 'done';

export interface ChaseState {
  active: boolean;
  t: number;
  mode: MmMode;
  enterT: number;
  lane: 'floor' | 'catwalk';
  stairT: number;
  stairFrom: 'floor' | 'catwalk';
  passageT: number;
  waitT: number;
  holdT: number;
  otherLaneT: number;
  gateDecided: boolean;
  interceptDecided: boolean;
  gates: GateState[];
  leonVx: number;
  predicted: { x: number; lane: Lane; conf: number };
  subjectLost: boolean;
  doorClosed: boolean;
  doorT: number;
}

export function createChase(): ChaseState {
  return {
    active: false,
    t: 0,
    mode: 'inactive',
    enterT: CHASE.mmEnterDelay,
    lane: 'floor',
    stairT: 0,
    stairFrom: 'floor',
    passageT: 0,
    waitT: 0,
    holdT: 0,
    otherLaneT: 0,
    gateDecided: false,
    interceptDecided: false,
    gates: CHASE.gates.map((g) => ({ ...g, state: 'open', t: 0, bottom: g.open })),
    leonVx: 0,
    predicted: { x: 0, lane: 'floor', conf: 0 },
    subjectLost: false,
    doorClosed: false,
    doorT: 0,
  };
}

export function laneOf(l: LeonState): Lane {
  if (l.y < -0.5) return 'tunnel';
  if (l.y >= CATWALK_Y - 0.5) return 'catwalk';
  return 'floor';
}

const laneY = (lane: 'floor' | 'catwalk') => (lane === 'catwalk' ? CATWALK_Y : 0);

/** Gate + terminal door solids. */
export function chaseSolids(ch: ChaseState): Solid[] {
  const out: Solid[] = [];
  for (const g of ch.gates) {
    if (g.bottom < g.top - 0.02) out.push({ id: g.id, kind: 'gate', x0: g.x0, x1: g.x1, y0: g.bottom, y1: g.top });
  }
  if (ch.doorClosed) out.push({ id: 'terminalDoor', kind: 'door', x0: CHASE.doorX0, x1: CHASE.doorX1, y0: 0, y1: 3.2 });
  return out;
}

/** Is the gate on this lane closed enough to stop a person (MM-01 is 2.15 m tall, cannot slide). */
function gateBlocks(g: GateState, lane: 'floor' | 'catwalk', height: number): boolean {
  return g.lane === lane && g.bottom < laneY(lane) + height;
}

export function startChase(ch: ChaseState, guard: GuardState): void {
  ch.active = true;
  ch.mode = 'inactive';
  ch.enterT = CHASE.mmEnterDelay;
  guard.x = CHASE.mmEntryX;
  guard.y = 0;
  guard.mode = 'chase';
  guard.suspicion = 1;
  guard.facing = 1;
  guard.lookDir = 1;
}

/** Reset the chase for a respawn at a chase checkpoint. */
export function resetChaseAt(ch: ChaseState, guard: GuardState, checkpointId: string, cpX: number): void {
  const fresh = createChase();
  Object.assign(ch, fresh);
  ch.active = true;
  if (checkpointId === 'chaseMid') {
    ch.gateDecided = true;
    ch.mode = 'inactive';
    ch.enterT = 1.2;
    guard.x = cpX - CHASE.respawnBehind;
  } else {
    guard.x = CHASE.mmEntryX;
  }
  guard.y = 0;
  guard.mode = 'chase';
  guard.facing = 1;
  guard.lookDir = 1;
  guard.suspicion = 1;
}

export interface ChaseStepContext {
  leon: LeonState;
  guard: GuardState;
  events: SimEvent[];
}

export function stepChase(ch: ChaseState, dt: number, c: ChaseStepContext): { caught: boolean } {
  if (!ch.active) return { caught: false };
  const l = c.leon;
  const g = c.guard;
  const ev = c.events;
  ch.t += dt;
  g.speed = 0;
  const leonLane = laneOf(l);
  ch.leonVx += (l.vx - ch.leonVx) * Math.min(1, dt * 4);
  ch.predicted = {
    x: clamp(l.x + ch.leonVx * 1.4, CHASE.bounds.x0, CHASE.bounds.x1),
    lane: leonLane,
    conf: clamp(0.62 + 0.3 * Math.min(1, Math.abs(ch.leonVx) / 5.4), 0, 0.97),
  };

  // ---- Gates ----
  if (!ch.gateDecided && l.x >= CHASE.gateDecisionX && l.x < CHASE.gates[0].x0 && leonLane !== 'tunnel') {
    ch.gateDecided = true;
    const gate = ch.gates.find((gg) => gg.lane === leonLane)!;
    gate.state = 'warn';
    gate.t = 0;
    ev.push({ type: 'gateWarn', gate: gate.id, lane: leonLane, confidence: ch.predicted.conf });
  }
  for (const gate of ch.gates) {
    gate.t += dt;
    switch (gate.state) {
      case 'warn':
        if (gate.t >= CHASE.warnTime) {
          gate.state = 'closing';
          gate.t = 0;
        }
        break;
      case 'closing': {
        const k = Math.min(1, gate.t / gate.closeTime);
        let b = gate.open + (gate.closed - gate.open) * k;
        // Safety edge: a closing shutter never crushes Leon — it stops on top of him.
        const lx0 = l.x - 0.25;
        const lx1 = l.x + 0.25;
        if (lx1 > gate.x0 && lx0 < gate.x1 && l.y < b) b = Math.max(b, l.y + l.height + 0.02);
        gate.bottom = b;
        if (k >= 1) {
          gate.state = 'closed';
          gate.t = 0;
          ev.push({ type: 'gateClosed', gate: gate.id });
        }
        break;
      }
      case 'closed':
        if (gate.t >= CHASE.closedTime) {
          gate.state = 'opening';
          gate.t = 0;
        }
        break;
      case 'opening': {
        const k = Math.min(1, gate.t / CHASE.openTime);
        gate.bottom = gate.closed + (gate.open - gate.closed) * k;
        if (k >= 1) {
          gate.state = 'open';
          gate.bottom = gate.open;
          ev.push({ type: 'gateOpen', gate: gate.id });
        }
        break;
      }
      default:
        break;
    }
  }

  // ---- Terminal room door (the end of the chase) ----
  if (!ch.doorClosed && ((l.x >= CHASE.roomEnterX && leonLane === 'floor') || (l.x >= 94 && leonLane === 'tunnel'))) {
    ch.doorClosed = true;
    ch.mode = 'done';
    ev.push({ type: 'doorClosed' });
  }

  // ---- MM-01 ----
  if (ch.mode === 'inactive') {
    ch.enterT -= dt;
    if (ch.enterT <= 0) {
      ch.mode = 'pursue';
      ch.lane = 'floor';
      g.y = 0;
      ev.push({ type: 'mmEnter', x: g.x });
    }
    return { caught: false };
  }

  if (ch.mode === 'done') {
    // Walk up to the glass and stare.
    move(g, ch, CHASE.doorX0 - 0.7, CHASE.speed * 0.7, dt);
    g.facing = 1;
    g.lookDir = 1;
    return { caught: false };
  }

  // Third way: Leon in the duct → MIRROR loses him; MM-01 goes to guard the door.
  if (leonLane === 'tunnel' && ch.mode !== 'stairs' && ch.mode !== 'passage') {
    if (!ch.subjectLost) {
      ch.subjectLost = true;
      ev.push({ type: 'subjectLost' });
    }
    ch.mode = 'blocked';
  } else if (ch.mode === 'blocked' && leonLane !== 'tunnel') {
    ch.subjectLost = false;
    ch.mode = 'pursue';
  }

  // Intercept decision.
  if (!ch.interceptDecided && l.x >= CHASE.interceptDecisionX && leonLane !== 'tunnel') {
    ch.interceptDecided = true;
    if (leonLane === 'floor' && ch.lane === 'floor' && ch.mode === 'pursue' && g.x < l.x - 1) {
      ch.mode = 'passage';
      ch.passageT = 0;
      ev.push({ type: 'intercept', kind: 'passage', x: CHASE.passageDoorX });
    } else if (leonLane === 'catwalk' && ch.lane === 'floor' && ch.mode === 'pursue') {
      ch.mode = 'wait';
      ch.waitT = 0;
      ev.push({ type: 'intercept', kind: 'landing', x: CHASE.landingWaitX });
    }
  }

  switch (ch.mode) {
    case 'stairs': {
      ch.stairT += dt;
      const k = Math.min(1, ch.stairT / CHASE.stairTime);
      const from = laneY(ch.stairFrom);
      const to = laneY(ch.stairFrom === 'floor' ? 'catwalk' : 'floor');
      g.y = from + (to - from) * k;
      g.speed = 1.2;
      if (k >= 1) {
        ch.lane = ch.stairFrom === 'floor' ? 'catwalk' : 'floor';
        g.y = laneY(ch.lane);
        ch.mode = 'pursue';
        ch.otherLaneT = 0;
      }
      return { caught: false };
    }
    case 'passage': {
      ch.passageT += dt;
      if (ch.passageT >= CHASE.passageDelay && Math.abs(l.x - CHASE.passageDoorX) >= CHASE.passageMinGap) {
        g.x = CHASE.passageDoorX;
        g.y = 0;
        g.facing = -1;
        g.lookDir = -1;
        ch.lane = 'floor';
        ch.mode = 'pursue';
        ch.holdT = CHASE.stepOutTime;
        ev.push({ type: 'mmEnter', x: g.x });
      }
      return { caught: false };
    }
    case 'blocked': {
      if (ch.lane === 'catwalk') takeOrWalkToStairs(g, ch, dt, ev, CHASE.doorX0);
      else move(g, ch, CHASE.doorX0 - 0.8, CHASE.speed, dt);
      return { caught: false };
    }
    case 'wait': {
      if (ch.lane === 'catwalk') {
        ch.mode = 'pursue';
        break;
      }
      const arrived = move(g, ch, CHASE.landingWaitX, CHASE.speed, dt);
      if (arrived) {
        ch.waitT += dt;
        g.facing = -1;
        g.lookDir = -1;
      }
      const near = leonLane === 'floor' && Math.abs(l.x - g.x) < 6;
      if (near || ch.waitT > CHASE.waitMax) ch.mode = 'pursue';
      if (catchable(g, ch, l)) return { caught: true };
      return { caught: false };
    }
    default:
      break;
  }

  // ---- Pursue ----
  if (ch.holdT > 0) {
    ch.holdT -= dt;
    return { caught: catchable(g, ch, l) };
  }
  if (leonLane === ch.lane || (leonLane === 'floor' && ch.lane === 'floor')) {
    ch.otherLaneT = 0;
    move(g, ch, l.x, CHASE.speed, dt);
  } else if (leonLane !== 'tunnel') {
    // Shadow Leon from the other lane at MIRROR's predicted position; use the stairs when they help.
    ch.otherLaneT += dt;
    const target = ch.predicted.x;
    const stair = CHASE.stairs.find((s) => Math.abs(s - g.x) < 0.6);
    const stairUseful = stair !== undefined && Math.abs(stair - ch.predicted.x) < 7 && ch.otherLaneT > 0.5;
    if (stairUseful) {
      ch.mode = 'stairs';
      ch.stairT = 0;
      ch.stairFrom = ch.lane;
      ev.push({ type: 'mmStairs', to: ch.lane === 'floor' ? 'catwalk' : 'floor' });
      return { caught: false };
    }
    // Head for the stair nearest to the predicted position if one lies between, else shadow.
    const nearStair = CHASE.stairs.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const goStair = Math.abs(nearStair - target) < 7 && ch.otherLaneT > 0.5;
    move(g, ch, goStair ? nearStair : target, CHASE.speed, dt);
  }
  return { caught: catchable(g, ch, l) };
}

function catchable(g: GuardState, ch: ChaseState, l: LeonState): boolean {
  if (l.mode !== 'normal' && l.mode !== 'mantle') return false;
  const leonLane = laneOf(l);
  if (leonLane === 'tunnel') return false;
  const dx = Math.abs(l.x - g.x);
  if (dx > 0.95) return false;
  if (ch.lane === 'floor') return l.y <= 2.6; // reaches up onto stacks
  return leonLane === 'catwalk';
}

/** Move along the current lane toward x, respecting sealed gates and the paper drift. Returns arrival. */
function move(g: GuardState, ch: ChaseState, tx: number, speed: number, dt: number): boolean {
  let target = clamp(tx, CHASE.bounds.x0, CHASE.bounds.x1);
  for (const gate of ch.gates) {
    if (!gateBlocks(gate, ch.lane, 2.15)) continue;
    if (g.x <= gate.x0 && target > gate.x0 - 0.4) target = gate.x0 - 0.4;
    if (g.x >= gate.x1 && target < gate.x1 + 0.4) target = gate.x1 + 0.4;
  }
  if (ch.doorClosed && g.x < CHASE.doorX0 && target > CHASE.doorX0 - 0.5) target = CHASE.doorX0 - 0.5;
  let v = speed;
  if (ch.lane === 'floor' && g.x > CHASE.drift.x0 && g.x < CHASE.drift.x1) v *= CHASE.drift.mmMul;
  const d = target - g.x;
  if (Math.abs(d) > 0.05) {
    g.facing = d > 0 ? 1 : -1;
    g.lookDir = g.facing;
  }
  g.x = approach(g.x, target, v * dt);
  g.speed = Math.abs(d) > 0.05 ? v : 0;
  return Math.abs(target - g.x) < 0.06;
}

function takeOrWalkToStairs(g: GuardState, ch: ChaseState, dt: number, ev: SimEvent[], towardX: number): void {
  const stair = CHASE.stairs.reduce((a, b) => (Math.abs(b - towardX) < Math.abs(a - towardX) ? b : a));
  if (move(g, ch, stair, CHASE.speed, dt)) {
    ch.mode = 'stairs';
    ch.stairT = 0;
    ch.stairFrom = ch.lane;
    ev.push({ type: 'mmStairs', to: 'floor' });
  }
}
