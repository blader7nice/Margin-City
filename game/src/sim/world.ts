import { createGuard, updateGuard } from './guard';
import { clamp, overlaps } from './geom';
import { createLeon, updateLeon, LEON } from './leon';
import { createPuzzle, makeCartPushable, puzzleSolids, stepPuzzle, type PuzzleState } from './puzzle';
import { chaseSolids, createChase, resetChaseAt, startChase, stepChase, type ChaseState } from './chase';
import {
  AMBIENT_LIGHT,
  CHASE,
  CHECKPOINTS,
  FORECAST,
  GUARD_BOUNDS,
  GUARD_START,
  HIDE_SPOTS,
  LIGHT_ZONES,
  PATROL,
  REVEAL_GUARD,
  REVEAL_TRIGGER_X,
  SOLIDS,
  SPAWN,
  TERMINAL,
  TUNNEL_Y,
  VAULT,
} from './level';
import type { Checkpoint, GuardState, HideSpot, InputState, LeonState, LightZone, NoiseEvent, SimEvent, Solid } from './types';
import { NO_INPUT } from './types';

export const SIM_DT = 1 / 120;
export const REVEAL_DURATION = 3.4;
export const CAUGHT_DURATION = 1.6;

export interface SimOptions {
  /** Skip the one-time MM-01 reveal cutscene (tests, benchmarks). */
  skipReveal?: boolean;
  spawn?: { x: number; y: number };
  guardStart?: { x: number; facing: 1 | -1; patrolIndex?: number };
  /** MM-01 perceives nothing (benchmarks / screenshots). */
  godMode?: boolean;
  /** Start directly in the chase (alarm already raised) — tests, screenshots, benchmark. */
  startChase?: boolean;
  /** Start with the puzzle solved (Leon can use the ledge). */
  puzzleSolved?: boolean;
}

export function lightAt(x: number, y: number, zones: LightZone[] = LIGHT_ZONES): number {
  let l = AMBIENT_LIGHT;
  for (const z of zones) {
    const d = Math.hypot(x - z.x, y - z.y);
    if (d >= z.radius) continue;
    const t = 1 - d / z.radius;
    l = Math.max(l, z.intensity * (t * t * (3 - 2 * t)));
  }
  return clamp(l, 0, 1);
}

export class Simulation {
  readonly solids: Solid[] = SOLIDS;
  readonly hideSpots: HideSpot[] = HIDE_SPOTS;
  readonly checkpoints: Checkpoint[] = CHECKPOINTS;
  leon: LeonState;
  guard: GuardState;
  time = 0;
  checkpoint: Checkpoint;
  revealDone: boolean;
  revealT = 0;
  catches = 0;
  caughtT = 0;
  caughtReason: 'grabbed' | 'found' | null = null;
  finished = false;
  /** Events produced during the last step() call. */
  events: SimEvent[] = [];
  /** Noises produced during the last step() (consumed by the guard). */
  noises: NoiseEvent[] = [];
  /** Recent noises kept for debug drawing. */
  recentNoises: (NoiseEvent & { t: number })[] = [];

  godMode = false;
  puzzle: PuzzleState = createPuzzle();
  chase: ChaseState = createChase();
  /** Solids of the current step (static + moving puzzle parts + gates/doors). */
  solidsNow: Solid[] = SOLIDS;
  private prevInput: InputState = NO_INPUT;
  private dropThrough = { t: 0 };
  private readonly cartPushable = makeCartPushable(this.puzzle, () => chaseSolids(this.chase));

  constructor(opts: SimOptions = {}) {
    const spawn = opts.spawn ?? SPAWN;
    this.leon = createLeon(spawn.x, spawn.y);
    const gs = opts.guardStart ?? { x: GUARD_START.x, facing: GUARD_START.facing, patrolIndex: 0 };
    this.guard = createGuard(gs.x, gs.facing, gs.patrolIndex ?? 0);
    this.checkpoint = CHECKPOINTS[0];
    this.revealDone = !!opts.skipReveal;
    this.godMode = !!opts.godMode;
    if (opts.puzzleSolved || opts.startChase) {
      this.puzzle.cart.locked = true;
      this.puzzle.hL = 0;
      this.puzzle.hR = 4.4;
      this.puzzle.solved = true;
    }
    if (opts.startChase) {
      this.puzzle.alarm = true;
      this.puzzle.hatchOpen = true;
      this.revealDone = true;
      this.beginChase();
      if (!opts.spawn) {
        const cp = CHECKPOINTS.find((c) => c.id === 'chaseStart')!;
        this.leon = createLeon(cp.x, cp.y);
      }
    }
  }

  private beginChase(): void {
    startChase(this.chase, this.guard);
    if (this.godMode) {
      this.chase.gateDecided = true;
      this.chase.interceptDecided = true;
    }
    this.checkpoint = CHECKPOINTS.find((c) => c.id === 'chaseStart')!;
  }

  /** Benchmark/debug shortcut: puzzle solved, alarm raised, Leon placed in the archive wing. */
  debugStartChase(x: number, y: number): void {
    this.puzzle.cart.locked = true;
    this.puzzle.hL = 0;
    this.puzzle.hR = 4.4;
    this.puzzle.solved = true;
    this.puzzle.alarm = true;
    this.puzzle.hatchOpen = true;
    this.revealDone = true;
    this.beginChase();
    this.leon = createLeon(x, y);
  }

  /** Story beat after Terminal B-12 + Dave's recording: The Last Shift is complete. */
  completeStory(): void {
    if (this.finished) return;
    this.finished = true;
    this.events.push({ type: 'finished' });
  }

  allSolids(): Solid[] {
    return [...SOLIDS, ...puzzleSolids(this.puzzle), ...chaseSolids(this.chase)];
  }

  get forecastHotspot(): HideSpot | null {
    return this.hideSpots.find((h) => h.id === FORECAST.hotspotId) ?? null;
  }

  step(input: InputState, dt = SIM_DT): void {
    this.events = [];
    this.noises = [];
    this.time += dt;
    const jumpPressed = input.jump && !this.prevInput.jump;
    const jumpReleased = !input.jump && this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    this.prevInput = { ...input };
    const leon = this.leon;

    // Cutscene / caught gating.
    if (leon.mode === 'cutscene') {
      this.revealT += dt;
      const skip = this.revealT > 0.6 && (jumpPressed || interactPressed);
      if (this.revealT >= REVEAL_DURATION || skip) {
        leon.mode = 'normal';
        leon.modeT = 0;
      }
    }
    if (leon.mode === 'caught') {
      this.caughtT += dt;
      if (this.caughtT >= CAUGHT_DURATION) this.respawn();
    }

    this.solidsNow = this.allSolids();
    const consumed = { v: false };
    const canAct = leon.mode === 'normal' || leon.mode === 'hidden';
    updateLeon(leon, dt, {
      solids: this.solidsNow,
      hideSpots: this.hideSpots,
      input: canAct ? input : NO_INPUT,
      jumpPressed: canAct ? jumpPressed : false,
      jumpReleased,
      interactPressed: canAct ? interactPressed : false,
      events: this.events,
      noises: this.noises,
      dropThrough: this.dropThrough,
      pushables: [this.cartPushable],
      slowZones: [{ x0: CHASE.drift.x0, x1: CHASE.drift.x1, y0: 0, y1: 0.3, mul: CHASE.drift.leonMul }],
      ductY: TUNNEL_Y,
      interactConsumed: consumed,
    });

    // Puzzle mechanics (cages, cart, lever, hatch panel).
    const wasAlarm = this.puzzle.alarm;
    const used = stepPuzzle(this.puzzle, dt, {
      leon,
      interactPressed: canAct && interactPressed && !consumed.v && leon.mode === 'normal',
      events: this.events,
      extraSolids: () => chaseSolids(this.chase),
    });
    if (!wasAlarm && this.puzzle.alarm) this.beginChase();
    // The vault itself is sealed: a clear "find another way" beat.
    if (canAct && interactPressed && !consumed.v && !used && leon.mode === 'normal' && leon.grounded) {
      if (Math.abs(VAULT.x - leon.x) <= VAULT.reach && leon.y < 0.5) this.events.push({ type: 'sealed' });
      // Terminal B-12 (only once the safe room is sealed).
      if (this.chase.doorClosed && Math.abs(TERMINAL.x - leon.x) <= TERMINAL.reach && leon.y > -0.3 && leon.y < 0.5) this.events.push({ type: 'terminal' });
    }

    leon.light = lightAt(leon.x, leon.y + leon.height * 0.55);

    // One-time reveal of MM-01 when Leon first enters the hall.
    if (!this.revealDone && leon.mode === 'normal' && leon.x > REVEAL_TRIGGER_X && leon.grounded) {
      this.revealDone = true;
      this.revealT = 0;
      leon.mode = 'cutscene';
      leon.modeT = 0;
      leon.vx = 0;
      this.guard = createGuard(REVEAL_GUARD.x, REVEAL_GUARD.facing, REVEAL_GUARD.patrolIndex);
      this.guard.pauseT = REVEAL_DURATION + 0.6;
      this.events.push({ type: 'reveal' });
    }

    // Checkpoints.
    const box = { x0: leon.x - LEON.halfW, x1: leon.x + LEON.halfW, y0: leon.y, y1: leon.y + leon.height };
    for (const cp of this.checkpoints) {
      if (cp === this.checkpoint) continue;
      if (CHECKPOINTS.indexOf(cp) <= CHECKPOINTS.indexOf(this.checkpoint)) continue;
      if (leon.grounded && overlaps(box, cp.area)) {
        this.checkpoint = cp;
        this.events.push({ type: 'checkpoint', id: cp.id });
      }
    }

    if (this.chase.active) {
      const r = stepChase(this.chase, dt, { leon, guard: this.guard, events: this.events });
      if (r.caught && !this.godMode && leon.mode !== 'caught') {
        leon.mode = 'caught';
        leon.modeT = 0;
        this.caughtT = 0;
        this.caughtReason = 'grabbed';
        this.catches++;
        this.events.push({ type: 'caught', reason: 'grabbed' });
      }
      this.finishStep();
      return;
    }

    const perceptionEnabled = !this.godMode && leon.mode !== 'cutscene' && leon.mode !== 'caught' && leon.mode !== 'finished';
    const res = updateGuard(this.guard, dt, {
      leon,
      solids: this.solidsNow,
      hideSpots: this.hideSpots,
      patrol: PATROL,
      bounds: GUARD_BOUNDS,
      forecastHotspot: this.forecastHotspot,
      noises: this.noises,
      events: this.events,
      time: this.time,
      perceptionEnabled,
    });
    if (res.caught && leon.mode !== 'caught') {
      leon.mode = 'caught';
      leon.modeT = 0;
      this.caughtT = 0;
      this.caughtReason = res.caught;
      this.catches++;
      this.events.push({ type: 'caught', reason: res.caught });
    }
    this.finishStep();
  }

  private finishStep(): void {
    for (const n of this.noises) this.recentNoises.push({ ...n, t: this.time });
    this.recentNoises = this.recentNoises.filter((n) => this.time - n.t < 1.2);
  }

  respawn(): void {
    const cp = this.checkpoint;
    const l = createLeon(cp.x, cp.y);
    l.facing = 1;
    this.leon = l;
    this.caughtReason = null;
    if (this.chase.active) {
      resetChaseAt(this.chase, this.guard, cp.id, cp.x);
      if (this.godMode) {
        this.chase.gateDecided = true;
        this.chase.interceptDecided = true;
      }
      this.events.push({ type: 'respawn', checkpoint: cp.id });
      return;
    }
    // Put MM-01 on the patrol point furthest from the checkpoint, calm.
    let far = 0;
    for (let i = 1; i < PATROL.length; i++) if (Math.abs(PATROL[i].x - cp.x) > Math.abs(PATROL[far].x - cp.x)) far = i;
    const facing: 1 | -1 = PATROL[far].x > cp.x ? -1 : 1;
    this.guard = createGuard(PATROL[far].x, facing, far);
    this.guard.pauseT = 1.5;
    this.events.push({ type: 'respawn', checkpoint: cp.id });
  }
}
