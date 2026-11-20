// Playtest telemetry: pure, deterministic, no DOM. Fed with simulation events + per-step state.
// Everything stays local (localStorage / clipboard / file download in the browser); nothing is sent anywhere.
import type { Lane, SimEvent } from './types';
import type { Simulation } from './world';
import { laneOf } from './chase';

export const TELEMETRY_VERSION = 1;

export interface CatchRecord {
  t: number;
  x: number;
  y: number;
  reason: 'grabbed' | 'found';
  /** Last checkpoint before the catch (= the segment being played). */
  segment: string;
  lane: Lane;
  guardMode: string;
  chaseMode: string;
  /** Seconds since the last gate warning (null = none in the last 15 s). */
  sinceGateWarn: number | null;
}

export interface GateWarnRecord {
  t: number;
  gate: string;
  lane: Lane;
  leonLaneAtWarn: Lane;
  /** Leon's lane when the gate actually closed; null if it never closed while recorded. */
  leonLaneAtClose: Lane | null;
  /** Leon left the warned lane before it closed (the telegraph worked). */
  dodged: boolean | null;
  /** Caught within 3 s after the warning. */
  caughtAfter: boolean;
}

export interface SegmentRecord {
  id: string;
  /** First time this checkpoint was reached. */
  reachedAt: number;
  /** Time spent from reaching it to reaching the next one (null while current). */
  duration: number | null;
  retries: number;
}

export interface TelemetryReport {
  version: number;
  build: string;
  startedAt: string;
  quality: string;
  tuning: Record<string, number>;
  totalTime: number;
  finished: boolean;
  catches: CatchRecord[];
  segments: SegmentRecord[];
  gateWarnings: GateWarnRecord[];
  chase: { started: number | null; ended: number | null; laneSeconds: Record<Lane, number>; laneSwitches: number; intercepts: number; stairsByMM: number };
  actions: { jumps: number; slides: number; hides: number; pushSeconds: number; ductEntries: number; mantles: number };
  terminal: { opened: number; decision: unknown } | null;
  ratings: Record<string, number>;
  notes: string;
}

export class Telemetry {
  private r: TelemetryReport;
  private seg: SegmentRecord | null = null;
  private lastLane: Lane | null = null;
  private lastWarnT = -99;
  private wasInTunnel = false;

  constructor(meta: { build: string; quality: string; tuning: Record<string, number>; startedAt?: string }) {
    this.r = {
      version: TELEMETRY_VERSION,
      build: meta.build,
      startedAt: meta.startedAt ?? new Date().toISOString(),
      quality: meta.quality,
      tuning: meta.tuning,
      totalTime: 0,
      finished: false,
      catches: [],
      segments: [],
      gateWarnings: [],
      chase: { started: null, ended: null, laneSeconds: { floor: 0, catwalk: 0, tunnel: 0 }, laneSwitches: 0, intercepts: 0, stairsByMM: 0 },
      actions: { jumps: 0, slides: 0, hides: 0, pushSeconds: 0, ductEntries: 0, mantles: 0 },
      terminal: null,
      ratings: {},
      notes: '',
    };
  }

  get report(): TelemetryReport {
    return this.r;
  }

  /** Call once per simulation step, after sim.step(), with that step's events. */
  step(sim: Simulation, dt: number): void {
    const r = this.r;
    r.totalTime = sim.time;
    const l = sim.leon;
    if (!this.seg) this.enterSegment(sim.checkpoint.id, sim.time);
    for (const e of sim.events) this.onEvent(e, sim);
    // completeStory() may run between steps (terminal UI), so also latch the flag itself.
    if (sim.finished && !r.finished) this.onEvent({ type: 'finished' }, sim);
    if (l.pushing) r.actions.pushSeconds += dt;
    const lane = laneOf(l);
    const inTunnel = lane === 'tunnel';
    if (inTunnel && !this.wasInTunnel) r.actions.ductEntries++;
    this.wasInTunnel = inTunnel;
    const ch = sim.chase;
    if (ch.active && !ch.doorClosed && l.mode !== 'caught') {
      r.chase.laneSeconds[lane] += dt;
      if (this.lastLane && lane !== this.lastLane) r.chase.laneSwitches++;
      this.lastLane = lane;
    } else this.lastLane = null;
    // Resolve pending gate warnings.
    for (const w of r.gateWarnings) {
      if (!w.caughtAfter && l.mode === 'caught' && sim.time - w.t < 3) w.caughtAfter = true;
    }
  }

  private enterSegment(id: string, t: number): void {
    const existing = this.r.segments.find((s) => s.id === id);
    if (existing) {
      this.seg = existing;
      return;
    }
    if (this.seg && this.seg.duration === null) this.seg.duration = +(t - this.seg.reachedAt).toFixed(2);
    this.seg = { id, reachedAt: +t.toFixed(2), duration: null, retries: 0 };
    this.r.segments.push(this.seg);
  }

  onEvent(e: SimEvent, sim: Simulation): void {
    const r = this.r;
    const l = sim.leon;
    switch (e.type) {
      case 'jump':
        r.actions.jumps++;
        break;
      case 'slide':
        r.actions.slides++;
        break;
      case 'hide':
        r.actions.hides++;
        break;
      case 'mantle':
        r.actions.mantles++;
        break;
      case 'checkpoint':
        this.enterSegment(e.id, sim.time);
        break;
      case 'respawn':
        if (this.seg) this.seg.retries++;
        break;
      case 'caught': {
        const since = sim.time - this.lastWarnT;
        r.catches.push({
          t: +sim.time.toFixed(2),
          x: +l.x.toFixed(2),
          y: +l.y.toFixed(2),
          reason: e.reason,
          segment: sim.checkpoint.id,
          lane: laneOf(l),
          guardMode: sim.guard.mode,
          chaseMode: sim.chase.active ? sim.chase.mode : 'off',
          sinceGateWarn: since <= 15 ? +since.toFixed(2) : null,
        });
        break;
      }
      case 'gateWarn':
        this.lastWarnT = sim.time;
        r.gateWarnings.push({ t: +sim.time.toFixed(2), gate: e.gate, lane: e.lane, leonLaneAtWarn: laneOf(l), leonLaneAtClose: null, dodged: null, caughtAfter: false });
        break;
      case 'gateClosed': {
        const w = [...r.gateWarnings].reverse().find((g) => g.gate === e.gate && g.leonLaneAtClose === null);
        if (w) {
          w.leonLaneAtClose = laneOf(l);
          w.dodged = w.leonLaneAtClose !== w.lane || (w.leonLaneAtWarn !== w.lane);
        }
        break;
      }
      case 'mmEnter':
        if (r.chase.started === null) r.chase.started = +sim.time.toFixed(2);
        break;
      case 'intercept':
        r.chase.intercepts++;
        break;
      case 'mmStairs':
        r.chase.stairsByMM++;
        break;
      case 'doorClosed':
        r.chase.ended = +sim.time.toFixed(2);
        break;
      case 'terminal':
        r.terminal = { opened: +sim.time.toFixed(2), decision: r.terminal?.decision ?? null };
        break;
      case 'finished':
        r.finished = true;
        if (this.seg && this.seg.duration === null) this.seg.duration = +(sim.time - this.seg.reachedAt).toFixed(2);
        break;
      default:
        break;
    }
  }

  setTerminalDecision(d: unknown): void {
    this.r.terminal = { opened: this.r.terminal?.opened ?? this.r.totalTime, decision: d };
  }

  rate(question: string, value: number): void {
    this.r.ratings[question] = Math.max(1, Math.min(5, Math.round(value)));
  }

  setNotes(text: string): void {
    this.r.notes = text.slice(0, 2000);
  }

  /** Short human summary for the end card / clipboard header. */
  summary(): string {
    const r = this.r;
    const bySeg = new Map<string, number>();
    for (const c of r.catches) bySeg.set(c.segment, (bySeg.get(c.segment) ?? 0) + 1);
    const worst = [...bySeg.entries()].sort((a, b) => b[1] - a[1])[0];
    const dodged = r.gateWarnings.filter((g) => g.dodged === true).length;
    const decided = r.gateWarnings.filter((g) => g.dodged !== null).length;
    const lanes = r.chase.laneSeconds;
    const laneTot = lanes.floor + lanes.catwalk + lanes.tunnel || 1;
    return [
      `Czas ${Math.round(r.totalTime)} s · złapania ${r.catches.length}${worst ? ` (najwięcej: ${worst[0]} ×${worst[1]})` : ''}`,
      `Bramy MIRROR: uniknięte ${dodged}/${decided} · przechwycenia ${r.chase.intercepts}`,
      `Trasy w pościgu: podłoga ${Math.round((lanes.floor / laneTot) * 100)}% · kładka ${Math.round((lanes.catwalk / laneTot) * 100)}% · kanał ${Math.round((lanes.tunnel / laneTot) * 100)}% · zmiany ${r.chase.laneSwitches}`,
      `Akcje: skoki ${r.actions.jumps} · wślizgi ${r.actions.slides} · kryjówki ${r.actions.hides} · wejścia do kanału ${r.actions.ductEntries}`,
    ].join('\n');
  }

  toJSON(): string {
    return JSON.stringify(this.r, null, 1);
  }
}

/** URL tuning knobs for chase playtests. Returns the values actually applied (for the report). */
export const TUNING_KNOBS: Record<string, { path: string; min: number; max: number }> = {
  warn: { path: 'warnTime', min: 0.3, max: 3 },
  mmspeed: { path: 'speed', min: 2.5, max: 6.5 },
  gap: { path: 'passageMinGap', min: 1, max: 8 },
  stepout: { path: 'stepOutTime', min: 0.2, max: 2.5 },
  respawn: { path: 'respawnBehind', min: 4, max: 25 },
  closed: { path: 'closedTime', min: 2, max: 12 },
};

export function applyTuning(params: URLSearchParams, target: Record<string, unknown>): Record<string, number> {
  const applied: Record<string, number> = {};
  for (const [key, k] of Object.entries(TUNING_KNOBS)) {
    const raw = params.get(key);
    if (raw === null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const c = Math.max(k.min, Math.min(k.max, v));
    target[k.path] = c;
    applied[key] = c;
  }
  return applied;
}
