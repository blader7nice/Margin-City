import { describe, expect, it } from 'vitest';
import { Simulation, SIM_DT } from '../src/sim/world';
import { CHASE } from '../src/sim/level';
import { laneOf } from '../src/sim/chase';
import { Telemetry, applyTuning } from '../src/sim/telemetry';
import type { InputState } from '../src/sim/types';
import { NO_INPUT } from '../src/sim/types';

const inp = (p: Partial<InputState>): InputState => ({ ...NO_INPUT, ...p });
const tap = (s: Simulation) => Math.floor(s.time / SIM_DT) % 2 === 0;
const meta = { build: 'test', quality: 'test', tuning: {}, startedAt: '2031-03-03T00:00:00Z' };

function play(sim: Simulation, tel: Telemetry, policy: (s: Simulation) => InputState, until: (s: Simulation) => boolean, maxT: number): void {
  for (let t = 0; t < maxT && !until(sim); t += SIM_DT) {
    sim.step(policy(sim));
    tel.step(sim, SIM_DT);
  }
}

/** Same improvising player as the M02 chase test: heeds the G1 warning, takes the duct. */
function smartRunner(s: Simulation, st: { warnedG1: boolean }): InputState {
  const l = s.leon;
  if (s.events.some((e) => e.type === 'gateWarn' && e.gate === 'G1')) st.warnedG1 = true;
  const lane = laneOf(l);
  const p = inp({ right: true, run: true });
  if (lane === 'catwalk' && st.warnedG1 && l.x < 62.5 && l.grounded) return { ...p, down: true, jump: tap(s) };
  if (lane === 'floor' && l.x > 80.15 && l.x < 81.05 && l.grounded) return { ...p, right: false, run: false, down: true, jump: tap(s) };
  if (lane === 'tunnel') return { ...p, run: false, crouch: l.x < 94.6, jump: l.x > 94.6 && tap(s) };
  if (l.grounded && Math.abs(l.vx) < 0.2) p.jump = tap(s);
  return p;
}

describe('Playtest telemetry', () => {
  it('records a catch at the gate the runner ignored, with segment, lane and time since the warning', () => {
    const sim = new Simulation({ startChase: true });
    const tel = new Telemetry(meta);
    play(sim, tel, () => inp({ right: true, run: true }), (s) => s.catches > 0, 30);
    const r = tel.report;
    expect(r.catches.length).toBe(1);
    const c = r.catches[0];
    expect(c.lane).toBe('catwalk');
    expect(c.x).toBeLessThan(CHASE.gates[0].x0 + 0.5);
    expect(c.sinceGateWarn).not.toBeNull();
    const w = r.gateWarnings.find((g) => g.gate === 'G1')!;
    expect(w.leonLaneAtWarn).toBe('catwalk');
    expect(w.dodged).toBe(false);
    expect(r.chase.started).not.toBeNull();
  });

  it('a clean run: warning dodged, duct used, lane time split, no catches, segment durations closed', () => {
    const sim = new Simulation({ startChase: true });
    const tel = new Telemetry(meta);
    const st = { warnedG1: false };
    play(sim, tel, (s) => smartRunner(s, st), (s) => s.chase.doorClosed, 45);
    const r = tel.report;
    expect(r.catches.length).toBe(0);
    expect(r.gateWarnings.some((g) => g.gate === 'G1' && g.dodged === true)).toBe(true);
    expect(r.actions.ductEntries).toBeGreaterThanOrEqual(1);
    expect(r.chase.laneSeconds.tunnel).toBeGreaterThan(0.5);
    expect(r.chase.laneSeconds.floor).toBeGreaterThan(1);
    expect(r.chase.laneSwitches).toBeGreaterThanOrEqual(2);
    expect(r.chase.ended).not.toBeNull();
    sim.completeStory();
    tel.step(sim, SIM_DT);
    expect(r.finished).toBe(true);
    expect(r.segments.every((s) => s.duration !== null)).toBe(true);
    expect(tel.summary()).toContain('złapania 0');
  });

  it('retries are counted on the segment where the player respawns', () => {
    const sim = new Simulation({ startChase: true });
    const tel = new Telemetry(meta);
    play(sim, tel, () => inp({ right: true, run: true }), (s) => s.catches >= 2, 60);
    const seg = tel.report.segments.find((s) => s.retries > 0);
    expect(seg).toBeDefined();
    expect(tel.report.catches.length).toBe(2);
  });

  it('report is plain JSON, ratings are clamped to 1..5', () => {
    const tel = new Telemetry(meta);
    tel.rate('fair', 9);
    tel.rate('tension', 0);
    const back = JSON.parse(tel.toJSON());
    expect(back.ratings).toEqual({ fair: 5, tension: 1 });
    expect(back.version).toBe(1);
  });

  it('URL tuning knobs are clamped and reported', () => {
    const target: Record<string, unknown> = { warnTime: 1.2, speed: 4.4 };
    const applied = applyTuning(new URLSearchParams('warn=0.01&mmspeed=5&bogus=3&gap=abc'), target);
    expect(applied).toEqual({ warn: 0.3, mmspeed: 5 });
    expect(target).toMatchObject({ warnTime: 0.3, speed: 5 });
  });
});
