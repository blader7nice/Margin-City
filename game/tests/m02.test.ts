import { describe, expect, it } from 'vitest';
import { Simulation, SIM_DT } from '../src/sim/world';
import { CATWALK_Y, CHASE, LEDGE_Y, PUZZLE } from '../src/sim/level';
import { LEON } from '../src/sim/leon';
import { laneOf } from '../src/sim/chase';
import type { InputState, SimEvent } from '../src/sim/types';
import { NO_INPUT } from '../src/sim/types';

const inp = (p: Partial<InputState>): InputState => ({ ...NO_INPUT, ...p });

function run(sim: Simulation, policy: (s: Simulation) => InputState, cond: (s: Simulation) => boolean, maxT = 20, log?: SimEvent[]): number {
  let t = 0;
  while (t < maxT) {
    sim.step(policy(sim));
    if (log) log.push(...sim.events);
    t += SIM_DT;
    if (cond(sim)) return t;
  }
  throw new Error(`timeout; leon x=${sim.leon.x.toFixed(2)} y=${sim.leon.y.toFixed(2)} mode=${sim.leon.mode} mm=${sim.guard.x.toFixed(1)}/${sim.chase.mode}`);
}
/** Press a button for one step, release next (edge-triggered actions). */
const tap = (s: Simulation) => Math.floor(s.time / SIM_DT) % 2 === 0;
const quiet = (spawn: { x: number; y: number }) => {
  const sim = new Simulation({ skipReveal: true, spawn, guardStart: { x: -11, facing: -1, patrolIndex: 0 } });
  sim.guard.pauseT = 1e9;
  return sim;
};

describe("Puzzle: The Archivist's Balance", () => {
  it('Leon alone is too light: the lever does nothing without the cart', () => {
    const sim = quiet({ x: 36.1, y: 0 });
    const log: SimEvent[] = [];
    run(sim, (s) => inp({ interact: s.leon.grounded && tap(s) }), () => log.some((e) => e.type === 'lever'), 2, log);
    expect(log.find((e) => e.type === 'lever')).toMatchObject({ result: 'tooLight' });
    for (let i = 0; i < 240; i++) sim.step(inp({}));
    expect(sim.puzzle.hR).toBe(0);
    expect(sim.puzzle.hL).toBe(PUZZLE.top);
  });

  it('the cart cannot be pushed off the left end of the gallery', () => {
    const sim = quiet({ x: 28.6, y: LEDGE_Y });
    for (let i = 0; i < 120 * 5; i++) sim.step(inp({ left: true }));
    // Leon walks around it? No: the cart blocks; but pushing left must stop at the bumper.
    expect(sim.puzzle.cart.x - PUZZLE.cartW / 2).toBeGreaterThanOrEqual(24.74);
    expect(sim.puzzle.cart.y).toBeCloseTo(LEDGE_Y, 2);
  });

  it('full solution: climb to the gallery, push the cart in, ride the right cage, open the hatch (alarm)', () => {
    const sim = quiet({ x: 23.9, y: 2.3 });
    const log: SimEvent[] = [];
    // 1. Up to the gallery (jump + mantle).
    run(sim, (s) => inp({ right: true, jump: s.leon.grounded && s.leon.y < 3 }), (s) => s.leon.grounded && Math.abs(s.leon.y - LEDGE_Y) < 0.01, 4, log);
    // 2. Push the cart into the left cage until it locks.
    run(sim, () => inp({ right: true }), (s) => s.puzzle.cart.locked, 10, log);
    expect(log.some((e) => e.type === 'push')).toBe(true);
    // 3. Back off and drop through the gallery to the floor.
    run(sim, () => inp({ left: true }), (s) => s.leon.x < 27.5, 3, log);
    run(sim, (s) => inp({ down: true, jump: tap(s) }), (s) => s.leon.grounded && s.leon.y < 0.01, 3, log);
    // 4. Walk into the right cage and pull the lever.
    run(sim, () => inp({ right: true }), (s) => s.leon.x > 35.9, 6, log);
    run(sim, (s) => inp({ interact: tap(s) }), () => log.some((e) => e.type === 'lever'), 2, log);
    expect(log.filter((e) => e.type === 'lever').pop()).toMatchObject({ result: 'moving' });
    run(sim, () => inp({}), (s) => s.puzzle.solved, 8, log);
    expect(sim.leon.y).toBeCloseTo(LEDGE_Y, 2);
    // 5. Onto the broken ledge, to the panel: alarm + hatch.
    run(sim, () => inp({ right: true }), (s) => s.leon.x > PUZZLE.panel.x - 0.3, 4, log);
    run(sim, (s) => inp({ interact: tap(s) }), (s) => s.puzzle.alarm, 2, log);
    expect(sim.puzzle.hatchOpen).toBe(true);
    expect(sim.chase.active).toBe(true);
    expect(sim.checkpoint.id).toBe('chaseStart');
  });

  it('the broken ledge is out of reach from the floor (no skipping the puzzle)', () => {
    const sim = quiet({ x: 40.5, y: 0 });
    for (let i = 0; i < 120 * 4; i++) sim.step(inp({ right: i % 120 < 60, left: i % 120 >= 60, jump: i % 30 < 15 }));
    expect(sim.leon.y).toBeLessThan(3);
  });
});

/** A chase bot that improvises like a player: drops when the catwalk gate is forecast, climbs stacks,
 *  takes the duct when MM-01 cuts off the floor. */
function chaseBot(s: Simulation, st: { warnedG1: boolean }): InputState {
  const l = s.leon;
  if (s.events.some((e) => e.type === 'gateWarn' && e.gate === 'G1')) st.warnedG1 = true;
  const lane = laneOf(l);
  const p = inp({ right: true, run: true });
  if (lane === 'catwalk' && st.warnedG1 && l.x < 62.5 && l.grounded) {
    p.down = true;
    p.jump = tap(s);
    return p;
  }
  if (lane === 'floor' && l.x > 80.15 && l.x < 81.05 && l.grounded) {
    p.right = false;
    p.run = false;
    p.down = true;
    p.jump = tap(s);
    return p;
  }
  if (lane === 'tunnel') {
    p.run = false;
    p.crouch = l.x < 94.6;
    if (l.x > 94.6) p.jump = tap(s);
    return p;
  }
  if (l.grounded && Math.abs(l.vx) < 0.2) p.jump = tap(s);
  return p;
}

describe('Chase: MIRROR forecasts and MM-01 cut-offs', () => {
  it('a runner on the catwalk gets the catwalk gate (G1) sealed, and it really blocks', () => {
    const sim = new Simulation({ startChase: true });
    const log: SimEvent[] = [];
    run(sim, () => inp({ right: true, run: true }), (s) => s.chase.gates[0].state === 'closed', 6, log);
    const warn = log.find((e) => e.type === 'gateWarn');
    expect(warn).toMatchObject({ gate: 'G1', lane: 'catwalk' });
    for (let i = 0; i < 120 * 2; i++) sim.step(inp({ right: true, run: true }));
    expect(sim.leon.x).toBeLessThan(CHASE.gates[0].x0);
  });

  it('a runner on the floor gets the floor gate (G2) sealed', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 47, y: 0 } });
    const log: SimEvent[] = [];
    run(sim, (s) => inp({ right: true, run: true, jump: s.leon.grounded && Math.abs(s.leon.vx) < 0.2 && tap(s) }), () => log.some((e) => e.type === 'gateWarn'), 6, log);
    expect(log.find((e) => e.type === 'gateWarn')).toMatchObject({ gate: 'G2', lane: 'floor' });
  });

  it('sliding gets under a half-closed shutter', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 61, y: 0 }, godMode: true });
    const g2 = sim.chase.gates[1];
    g2.state = 'closed';
    g2.bottom = 1.15; // jammed half-way: too low to walk, high enough to slide
    g2.t = -100;
    run(sim, () => inp({ right: true, run: true }), (s) => s.leon.x > 64.5, 3);
    run(sim, () => inp({ right: true, run: true, crouch: true }), (s) => s.leon.x > CHASE.gates[1].x1 + 0.3, 3);
    expect(sim.leon.x).toBeGreaterThan(CHASE.gates[1].x1);
  });

  it('MM-01 cannot catch a running Leon on the same lane from behind', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 68.5, y: 0 } });
    sim.chase.mode = 'pursue';
    sim.chase.gateDecided = true;
    sim.chase.interceptDecided = true;
    sim.guard.x = 64;
    let minGap = Infinity;
    for (let i = 0; i < 120 * 2.5; i++) {
      sim.step(inp({ right: true, run: true }));
      minGap = Math.min(minGap, sim.leon.x - sim.guard.x);
    }
    expect(sim.leon.mode).not.toBe('caught');
    expect(sim.leon.x - sim.guard.x).toBeGreaterThan(minGap);
    expect(CHASE.speed).toBeLessThan(LEON.run);
  });

  it('floor runner past the intercept line: MM-01 takes the service passage and steps out ahead', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 73, y: 0 } });
    sim.chase.mode = 'pursue';
    sim.chase.gateDecided = true;
    sim.guard.x = 66;
    const log: SimEvent[] = [];
    run(sim, () => inp({ right: true }), () => log.some((e) => e.type === 'intercept'), 3, log);
    expect(log.find((e) => e.type === 'intercept')).toMatchObject({ kind: 'passage' });
    run(sim, () => inp({}), (s) => s.chase.mode === 'pursue', 3);
    expect(sim.guard.x).toBeCloseTo(CHASE.passageDoorX, 1);
    expect(sim.guard.x).toBeGreaterThan(sim.leon.x);
  });

  it('catwalk runner past the intercept line: MM-01 waits at the predicted landing point', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 74, y: CATWALK_Y } });
    sim.chase.mode = 'pursue';
    sim.chase.gateDecided = true;
    sim.guard.x = 70;
    const log: SimEvent[] = [];
    run(sim, () => inp({ right: true }), () => log.some((e) => e.type === 'intercept'), 3, log);
    expect(log.find((e) => e.type === 'intercept')).toMatchObject({ kind: 'landing' });
    run(sim, () => inp({}), (s) => Math.abs(s.guard.x - CHASE.landingWaitX) < 0.1, 6);
  });

  it('the duct is the third way: MIRROR loses Leon and MM-01 cannot follow', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 80.6, y: 0 } });
    sim.chase.mode = 'pursue';
    sim.chase.gateDecided = true;
    sim.chase.interceptDecided = true;
    sim.guard.x = 76;
    const log: SimEvent[] = [];
    run(sim, (s) => inp({ down: true, jump: tap(s) }), (s) => laneOf(s.leon) === 'tunnel', 2, log);
    run(sim, (s) => inp({ right: true, crouch: s.leon.x < 94.6, jump: s.leon.x > 94.6 && tap(s) }), (s) => s.finished, 15, log);
    expect(log.some((e) => e.type === 'subjectLost')).toBe(true);
    expect(sim.catches).toBe(0);
    expect(sim.chase.doorClosed).toBe(true);
  });

  it('the whole chase is completable by an improvising player against the real MM-01', () => {
    const sim = new Simulation({ startChase: true });
    const st = { warnedG1: false };
    run(sim, (s) => chaseBot(s, st), (s) => s.finished, 45);
    expect(sim.catches).toBe(0);
  });

  it('respawning at the mid checkpoint resets gates and puts MM-01 a fair distance behind', () => {
    const sim = new Simulation({ startChase: true, spawn: { x: 74.6, y: CATWALK_Y } });
    run(sim, () => inp({ right: true }), (s) => s.checkpoint.id === 'chaseMid', 2);
    sim.chase.gates[0].state = 'closed';
    sim.chase.gates[0].bottom = CATWALK_Y;
    sim.respawn();
    expect(sim.chase.gates.every((g) => g.state === 'open')).toBe(true);
    expect(sim.leon.x - sim.guard.x).toBeGreaterThanOrEqual(CHASE.respawnBehind - 0.01);
  });
});
