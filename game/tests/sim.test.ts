import { describe, expect, it } from 'vitest';
import { Simulation, SIM_DT } from '../src/sim/world';
import { computeSight, createGuard, GUARD } from '../src/sim/guard';
import { createLeon, LEON } from '../src/sim/leon';
import { segmentHitsBox } from '../src/sim/geom';
import { SOLIDS, MEZZ_Y, HIDE_SPOTS } from '../src/sim/level';
import type { InputState } from '../src/sim/types';
import { NO_INPUT } from '../src/sim/types';

const inp = (p: Partial<InputState>): InputState => ({ ...NO_INPUT, ...p });

/** Run the sim with a policy until cond() or timeout. Returns elapsed seconds. */
function run(sim: Simulation, policy: (s: Simulation) => InputState, cond: (s: Simulation) => boolean, maxT = 20): number {
  let t = 0;
  while (t < maxT) {
    sim.step(policy(sim));
    t += SIM_DT;
    if (cond(sim)) return t;
  }
  throw new Error(`timeout; leon at x=${sim.leon.x.toFixed(2)} y=${sim.leon.y.toFixed(2)} mode=${sim.leon.mode}`);
}

function settle(sim: Simulation): void {
  for (let i = 0; i < 10; i++) sim.step(inp({}));
}

/** A guard far away and asleep: for pure traversal tests. */
function quietSim(spawn: { x: number; y: number }): Simulation {
  const sim = new Simulation({ skipReveal: true, spawn, guardStart: { x: 30, facing: 1, patrolIndex: 2 } });
  sim.guard.pauseT = 1e9;
  return sim;
}

describe('geometry', () => {
  it('segment vs box', () => {
    const box = { x0: 0, y0: 0, x1: 1, y1: 1 };
    expect(segmentHitsBox(-1, 0.5, 2, 0.5, box)).toBe(true);
    expect(segmentHitsBox(-1, 1.5, 2, 1.5, box)).toBe(false);
    expect(segmentHitsBox(-1, 1.0, 2, 1.0, box)).toBe(false); // grazing the top edge does not occlude
    expect(segmentHitsBox(-1, 0.5, -0.5, 0.5, box)).toBe(false); // ends before the box
  });
});

describe('Leon traversal (whole route is completable)', () => {
  it('descends the archive cabinets from the spawn catwalk', () => {
    const sim = quietSim({ x: -33, y: 6.6 });
    run(sim, (s) => inp({ right: true, jump: s.leon.grounded && s.leon.x > -27.2 && s.leon.y > 4 }), (s) => s.leon.x > -21.5 && s.leon.grounded && s.leon.y < 0.01, 12);
  });

  it('shutter blocks standing Leon', () => {
    const sim = quietSim({ x: -18, y: 0 });
    for (let i = 0; i < 240; i++) sim.step(inp({ right: true }));
    expect(sim.leon.x).toBeLessThan(-16.3);
    run(sim, () => inp({ right: true, crouch: true }), (s) => s.leon.x > -15.2, 6);
    // Stands back up once clear.
    run(sim, () => inp({ right: true }), (s) => !s.leon.crouching && s.leon.x > -14.5, 3);
  });

  it('jumps onto a counter', () => {
    const sim = quietSim({ x: -8, y: 0 });
    run(sim, (s) => inp({ right: true, jump: s.leon.x > -7.3 }), (s) => s.leon.grounded && Math.abs(s.leon.y - 1.05) < 0.01, 4);
  });

  it('reaches the mezzanine via crates (jump + mantle)', () => {
    const sim = quietSim({ x: -3.7, y: 0 });
    run(
      sim,
      (s) => inp({ right: true, jump: s.leon.grounded && s.leon.vx > 1 && (s.leon.x > -3.45 || s.leon.y > 0.5) }),
      (s) => s.leon.grounded && Math.abs(s.leon.y - MEZZ_Y) < 0.01,
      8,
    );
    expect(sim.events.some((e) => e.type === 'mantle') || sim.leon.y === MEZZ_Y).toBe(true);
  });

  it('walking jump falls short of the mezzanine gap, running jump clears it (and is noisy)', () => {
    const walk = quietSim({ x: 6.5, y: MEZZ_Y });
    run(walk, (s) => inp({ right: true, jump: s.leon.x > 7.85 && s.leon.grounded }), (s) => s.leon.y < 1 && s.leon.grounded, 6);
    expect(walk.leon.x).toBeLessThan(10.8);

    const runSim = quietSim({ x: 4.0, y: MEZZ_Y });
    let noisy = false;
    run(
      runSim,
      (s) => {
        if (s.events.some((e) => e.type === 'noise')) noisy = true;
        return inp({ right: true, run: true, jump: s.leon.x > 7.8 && s.leon.grounded });
      },
      (s) => s.leon.grounded && s.leon.x > 10.9 && Math.abs(s.leon.y - MEZZ_Y) < 0.01,
      6,
    );
    expect(noisy).toBe(true);
  });

  it('the vault B-12 is sealed (find another way)', () => {
    const sim = quietSim({ x: 36, y: 0 });
    let sealed = false;
    run(
      sim,
      (s) => {
        if (s.events.some((e) => e.type === 'sealed')) sealed = true;
        return inp({ right: s.leon.x < 38.6, interact: s.leon.x >= 38.6 && Math.floor(s.time * 10) % 2 === 0 });
      },
      () => sealed,
      6,
    );
    expect(sim.finished).toBe(false);
  });
});

describe('MM-01 perception fairness', () => {
  const solids = SOLIDS;

  it('sees a lit, standing Leon in front of him', () => {
    const g = createGuard(-11, 1, 0);
    const l = createLeon(-8.5, 0);
    l.light = 1;
    expect(computeSight(g, l, solids).visible).toBe(true);
  });

  it('does not see Leon behind him beyond the near-sense radius', () => {
    const g = createGuard(-5, 1, 0);
    const l = createLeon(-8, 0);
    l.light = 1;
    expect(computeSight(g, l, solids).visible).toBe(false);
  });

  it('a counter hides a crouching Leon on the far side, not a standing one', () => {
    const g = createGuard(20, -1, 0); // looking left toward counter C (x 12.6..15.0)
    const l = createLeon(12.2, 0);
    l.light = 0.6;
    l.crouching = true;
    l.height = LEON.hCrouch;
    expect(computeSight(g, l, solids).visible).toBe(false);
    const standing = createLeon(12.2, 0);
    standing.light = 0.6;
    expect(computeSight(g, standing, solids).visible).toBe(true);
  });

  it('cannot see through the mezzanine slab from below', () => {
    const g = createGuard(3, 1, 0);
    const l = createLeon(5.5, MEZZ_Y);
    l.light = 1;
    expect(computeSight(g, l, solids).visible).toBe(false);
  });

  it('a hidden Leon is invisible even at point-blank range', () => {
    const g = createGuard(-10.2, 1, 0);
    const l = createLeon(-9.4, 0);
    l.light = 1;
    l.mode = 'hidden';
    expect(computeSight(g, l, solids).visible).toBe(false);
  });

  it('darkness and crouching shrink the sight range', () => {
    const g = createGuard(0, 1, 0);
    const lit = createLeon(9, 0);
    lit.light = 1;
    const dark = createLeon(9, 0);
    dark.light = 0.1;
    dark.crouching = true;
    dark.height = LEON.hCrouch;
    expect(computeSight(g, lit, []).range).toBeGreaterThan(computeSight(g, dark, []).range * 1.8);
  });
});

describe('MM-01 behaviour fairness', () => {
  it('after losing sight he searches the LAST SEEN spot, not Leon\'s true position', () => {
    const sim = new Simulation({ skipReveal: true, spawn: { x: -8.6, y: 0 }, guardStart: { x: -11.4, facing: 1, patrolIndex: 0 } });
    sim.guard.pauseT = 0;
    // Stand in the light until he starts chasing.
    run(sim, () => inp({}), (s) => s.guard.mode === 'chase', 4);
    const seenX = sim.leon.x;
    // Teleport Leon (as if he vanished out of sight) far away and up on the mezzanine, out of view.
    sim.leon.x = 6;
    sim.leon.y = MEZZ_Y;
    sim.leon.crouching = true;
    sim.leon.height = LEON.hCrouch;
    run(sim, () => inp({ crouch: true }), (s) => s.guard.mode === 'search', 2);
    expect(Math.abs((sim.guard.lastKnown?.x ?? 99) - seenX)).toBeLessThan(2.0);
    expect(Math.abs((sim.guard.lastKnown?.x ?? 99) - 6)).toBeGreaterThan(5);
  });

  it('hearing a running footstep makes him suspicious toward the noise position', () => {
    const sim = new Simulation({ skipReveal: true, spawn: { x: 2.0, y: MEZZ_Y }, guardStart: { x: 6.6, facing: 1, patrolIndex: 1 } });
    sim.guard.pauseT = 3;
    run(sim, () => inp({ right: true, run: true }), (s) => s.guard.mode === 'suspicious', 3);
    expect(sim.guard.lastKnown).not.toBeNull();
  });

  it('hiding unseen in a non-forecast spot is safe; he does not open it', () => {
    const nook = HIDE_SPOTS.find((h) => h.id === 'nook')!;
    const sim = new Simulation({ skipReveal: true, spawn: { x: nook.x, y: 0 }, guardStart: { x: 22.5, facing: -1, patrolIndex: 2 } });
    settle(sim);
    sim.step(inp({ interact: true }));
    run(sim, () => inp({}), (s) => s.leon.mode === 'hidden', 1);
    // Force a search right next to the hiding place.
    sim.guard.mode = 'search';
    sim.guard.searchPhase = 'goto';
    sim.guard.lastKnown = { x: nook.x + 1, y: 0 };
    let caught = false;
    for (let i = 0; i < 120 * 12; i++) {
      sim.step(inp({}));
      if (sim.leon.mode === 'caught') caught = true;
    }
    expect(caught).toBe(false);
  });

  it('the MIRROR forecast hotspot IS checked during a search (visible risk)', () => {
    const booth = HIDE_SPOTS.find((h) => h.id === 'booth')!;
    const sim = new Simulation({ skipReveal: true, spawn: { x: booth.x, y: 0 }, guardStart: { x: 6.6, facing: -1, patrolIndex: 1 } });
    settle(sim);
    sim.step(inp({ interact: true }));
    run(sim, () => inp({}), (s) => s.leon.mode === 'hidden', 1);
    sim.guard.mode = 'search';
    sim.guard.searchPhase = 'goto';
    sim.guard.lastKnown = { x: -3, y: 0 };
    run(sim, () => inp({}), (s) => s.leon.mode === 'caught', 20);
    expect(sim.caughtReason).toBe('found');
  });

  it('if he SAW Leon enter a hiding place, he pulls him out', () => {
    const nook = HIDE_SPOTS.find((h) => h.id === 'nook')!;
    const sim = new Simulation({ skipReveal: true, spawn: { x: nook.x, y: 0 }, guardStart: { x: 3.5, facing: 1, patrolIndex: 1 } });
    sim.guard.pauseT = 0;
    sim.leon.light = 1;
    run(sim, () => inp({}), (s) => s.guard.suspicion > 0.4, 3);
    settle(sim);
    sim.step(inp({ interact: true }));
    run(sim, () => inp({}), (s) => s.leon.mode === 'caught', 15);
    expect(sim.caughtReason).toBe('found');
  });

  it('respawns at the checkpoint with MM-01 far away and calm', () => {
    const sim = new Simulation({ skipReveal: true, spawn: { x: -8.6, y: 0 }, guardStart: { x: -11.4, facing: 1, patrolIndex: 0 } });
    sim.guard.pauseT = 0;
    run(sim, () => inp({}), (s) => s.leon.mode === 'caught', 8);
    run(sim, () => inp({}), (s) => s.leon.mode === 'normal', 3);
    expect(sim.guard.mode).toBe('patrol');
    expect(Math.abs(sim.guard.x - sim.leon.x)).toBeGreaterThan(10);
    expect(GUARD.chaseSpeed).toBeLessThan(LEON.run); // a running Leon can always outpace him
  });
});
