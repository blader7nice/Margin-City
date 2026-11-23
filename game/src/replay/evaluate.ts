import type { MarketContext } from './analysis';
import type { OrderPreview } from './session';
import type { ManagementAction, OrderInput, ThesisId, Trade } from './types';

/**
 * Evaluation 2.0 — three separate things:
 *   1. PROCESS  — judged ONLY with information available at decision time (the visible-data context, the order,
 *                 and later management actions, each judged at the candle it was taken). The function signature has
 *                 no access to future candles; tests also verify invariance to the future.
 *   2. OUTCOME  — the money result (net of costs), shown separately.
 *   3. LESSONS  — educational commentary that explains the grade without pretending the future was knowable.
 * Grades are learning heuristics, not investment advice.
 */

export type Mark = 'good' | 'warn' | 'bad' | 'info';
export interface Criterion {
  id: string;
  label: string;
  /** 0..1 */
  value: number;
  weight: number;
  mark: Mark;
  note: string;
}

export interface Support {
  score: number;
  pro: string[];
  con: string[];
}

type Expect = 'long' | 'short' | 'skip' | 'range';

export interface ThesisDef {
  id: ThesisId;
  label: string;
  expects: Expect;
  support: (x: MarketContext) => Support;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function trendSupport(x: MarketContext, d: 'up' | 'down'): Support {
  const pro: string[] = [];
  const con: string[] = [];
  const sgn = d === 'up' ? 1 : -1;
  const slope = sgn * x.trend.slopeAtr;
  let s = clamp01((slope - 0.4) / 1.6) * (0.45 + 0.55 * x.trend.r2);
  if (x.trend.dir === d) pro.push(`trend ${d === 'up' ? 'wzrostowy' : 'spadkowy'} (${x.trend.slopeAtr.toFixed(1)} ATR/10 świec)`);
  else con.push('brak trendu w tym kierunku');
  if (x.structure === (d === 'up' ? 'HH-HL' : 'LH-LL')) {
    s += 0.15;
    pro.push(d === 'up' ? 'wyższe szczyty i dołki' : 'niższe szczyty i dołki');
  }
  if (x.ma50 != null && sgn * (x.last.c - x.ma50) > 0) {
    s += 0.08;
    pro.push(`cena ${d === 'up' ? 'nad' : 'pod'} MA50`);
  }
  if (x.climax === d) {
    s -= 0.25;
    con.push('ruch wygląda na klimaks — wejście w pogoni');
  }
  if (sgn * x.stretchAtr > 3) {
    s -= 0.15;
    con.push(`cena daleko od MA20 (${x.stretchAtr.toFixed(1)} ATR)`);
  }
  if (x.structureBreak && x.structureBreak !== d) {
    s -= 0.25;
    con.push('przełamana struktura trendu');
  }
  if (x.rebound && x.rebound !== d) {
    s -= 0.3;
    con.push('silne odreagowanie przeciw trendowi');
  }
  if (x.volRatio > 1.8) {
    s -= 0.1;
    con.push('wysoka zmienność');
  }
  return { score: clamp01(s), pro, con };
}

function breakoutSupport(x: MarketContext, d: 'up' | 'down'): Support {
  const pro: string[] = [];
  const con: string[] = [];
  let s = 0.1;
  if (x.breakout === d) {
    s = 0.5 + 0.3 * clamp01((x.breakoutVolume - 1.2) / 1.3);
    pro.push(`zamknięcie poza zakresem ${x.range.lo.toFixed(2)}–${x.range.hi.toFixed(2)}`);
    if (x.breakoutVolume > 1.6) pro.push(`wolumen ${x.breakoutVolume.toFixed(1)}× mediany`);
    else con.push('wybicie na słabym wolumenie');
  } else if (x.structureBreak === d) {
    s = 0.55;
    pro.push('przełamana struktura rynku');
  } else con.push('brak wybicia w tym kierunku');
  if (x.failedBreakout === d) {
    s -= 0.3;
    con.push('poprzednie wybicie w tę stronę się nie utrzymało');
  }
  if (x.squeeze) pro.push('po okresie ściśniętej zmienności');
  if (x.climax === d) {
    s -= 0.2;
    con.push('ruch już bardzo rozciągnięty (klimaks)');
  }
  return { score: clamp01(s), pro, con };
}

function reversalSupport(x: MarketContext, d: 'up' | 'down'): Support {
  // d = direction of the expected reversal (up = after a fall).
  const pro: string[] = [];
  const con: string[] = [];
  const fallDir = d === 'up' ? 'down' : 'up';
  let s = 0.1;
  if (x.climax === fallDir) {
    s = 0.42;
    pro.push(`klimaks ${fallDir === 'down' ? 'spadków' : 'wzrostów'} na wolumenie ${x.climaxVolume.toFixed(1)}× mediany`);
    if (Math.abs(x.stretchAtr) > 3) {
      s += 0.08;
      pro.push(`cena ${Math.abs(x.stretchAtr).toFixed(1)} ATR od MA20`);
    }
  } else if (x.failedBreakout === fallDir) {
    s = 0.55;
    pro.push(`nieudane wybicie ${fallDir === 'down' ? 'w dół' : 'w górę'} — cena wróciła do zakresu`);
  } else if (x.rebound === d) {
    s = 0.35;
    pro.push('rynek już odreagowuje');
    con.push('duża część odbicia może być już w cenie');
  } else con.push(`brak klimaksu ${fallDir === 'down' ? 'spadków' : 'wzrostów'} ani nieudanego wybicia`);
  const confirm = d === 'up' ? 'bull' : 'bear';
  if (x.reversalCandle === confirm) {
    s += 0.25;
    pro.push('świeca potwierdzająca odrzucenie');
  } else if (s > 0.3) con.push('brak potwierdzenia odwrócenia — łapanie spadającego noża');
  if (x.trend.dir === fallDir && x.trend.strength === 'strong') {
    s -= 0.05;
    con.push('gra przeciw silnemu trendowi');
  }
  return { score: clamp01(s), pro, con };
}

function rangeSupport(x: MarketContext): Support {
  const pro: string[] = [];
  const con: string[] = [];
  if (!x.range.isRange || x.breakout) return { score: 0.12, pro, con: ['brak stabilnego zakresu'] };
  pro.push(`zakres ${x.range.widthAtr.toFixed(1)} ATR, brak trendu`);
  const edge = Math.max(0, Math.abs(x.range.pos - 0.5) - 0.15) / 0.35;
  if (edge > 0.3) pro.push(`cena przy ${x.range.pos < 0.5 ? 'dolnej' : 'górnej'} granicy`);
  else con.push('cena w środku zakresu — słaba lokalizacja');
  return { score: clamp01(0.45 + 0.4 * edge), pro, con };
}

export const THESES: ThesisDef[] = [
  { id: 'trend_up', label: 'Kontynuacja trendu wzrostowego', expects: 'long', support: (x) => trendSupport(x, 'up') },
  { id: 'trend_down', label: 'Kontynuacja trendu spadkowego', expects: 'short', support: (x) => trendSupport(x, 'down') },
  { id: 'breakout_up', label: 'Wybicie w górę', expects: 'long', support: (x) => breakoutSupport(x, 'up') },
  { id: 'breakdown', label: 'Wybicie w dół / przełamanie', expects: 'short', support: (x) => breakoutSupport(x, 'down') },
  { id: 'capitulation_reversal', label: 'Kapitulacja — odwrócenie w górę', expects: 'long', support: (x) => reversalSupport(x, 'up') },
  { id: 'exhaustion_top', label: 'Wyczerpanie wzrostów — odwrócenie w dół', expects: 'short', support: (x) => reversalSupport(x, 'down') },
  { id: 'range', label: 'Konsolidacja — gra od granicy', expects: 'range', support: rangeSupport },
  {
    id: 'no_edge',
    label: 'Nie widzę przewagi',
    expects: 'skip',
    support: (x) => {
      const best = bestDirectional(x);
      const score = clamp01(1 - best.score * 1.15 + (x.volRatio > 1.8 ? 0.15 : 0));
      return { score, pro: best.score < 0.45 ? ['żaden scenariusz kierunkowy nie ma mocnego pokrycia'] : [], con: best.score >= 0.6 ? [`dane wyraźnie wspierały: ${best.label.toLowerCase()}`] : [] };
    },
  },
];

export function thesis(id: ThesisId): ThesisDef {
  return THESES.find((t) => t.id === id) ?? THESES[THESES.length - 1];
}

/** The strongest directional reading of the visible chart (used for skip evaluation and feedback). */
export function bestDirectional(x: MarketContext): { id: ThesisId; label: string; score: number } {
  let best = { id: 'no_edge' as ThesisId, label: 'brak', score: 0 };
  for (const t of THESES) {
    if (t.id === 'no_edge') continue;
    const sc = t.support(x).score;
    if (sc > best.score) best = { id: t.id, label: t.label, score: sc };
  }
  return best;
}

/** Which side a thesis justifies in this context (range depends on location). */
export function sideFor(t: ThesisDef, x: MarketContext): 'long' | 'short' | 'skip' {
  if (t.expects === 'range') return x.range.pos < 0.38 ? 'long' : x.range.pos > 0.62 ? 'short' : 'skip';
  return t.expects;
}

const markOf = (v: number): Mark => (v >= 0.8 ? 'good' : v >= 0.5 ? 'warn' : 'bad');
const C = (id: string, label: string, value: number, weight: number, note: string): Criterion => ({ id, label, value: clamp01(value), weight, mark: markOf(value), note });

export interface ProcessEval {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  criteria: Criterion[];
  /** Why the grade is capped (if it is). */
  caps: string[];
  support: Support;
  best: { id: ThesisId; label: string; score: number };
  counterTrend: boolean;
}

/** PROCESS evaluation — decision-time information only (context from visible candles, order, management log). */
export function evaluateProcess(x: MarketContext, order: OrderInput, preview: OrderPreview, actions: ManagementAction[] = []): ProcessEval {
  const t = thesis(order.thesis);
  const sup = t.support(x);
  const best = bestDirectional(x);
  const crit: Criterion[] = [];
  const caps: string[] = [];
  let cap = 100;
  const expectedConf = sup.score < 0.4 ? 1 : sup.score < 0.68 ? 2 : 3;

  if (order.side === 'skip') {
    const directional = t.expects === 'long' || t.expects === 'short';
    let ctxV: number;
    let ctxNote: string;
    if (best.score < 0.45) {
      ctxV = 1;
      ctxNote = 'Żaden scenariusz kierunkowy nie miał mocnego pokrycia w danych. Brak przewagi = brak transakcji.';
    } else if (best.score < 0.7) {
      ctxV = 0.85;
      ctxNote = `Były argumenty za „${best.label}” (${Math.round(best.score * 100)}%), ale niejednoznaczne. Pominięcie jest rozsądne.`;
    } else {
      ctxV = 0.55;
      ctxNote = `Dane wyraźnie wspierały „${best.label}” (${Math.round(best.score * 100)}%). Pominięcie jest dopuszczalne, ale nazwij, czego zabrakło.`;
    }
    crit.push(C('context', 'Ocena sytuacji', ctxV, 0.45, ctxNote));
    const unc = !directional ? 1 : order.confidence === 1 ? 0.85 : order.confidence === 2 ? 0.6 : 0.35;
    crit.push(
      C('uncertainty', 'Niepewność: teza a decyzja', unc, 0.25, !directional ? 'Teza i decyzja spójne.' : `Wybrałeś tezę kierunkową („${t.label}”) z pewnością ${['niską', 'średnią', 'wysoką'][order.confidence - 1]}, a jednak bez transakcji. Jeśli zabrakło potwierdzenia — to sygnał niskiej pewności.`),
    );
    crit.push(C('capital', 'Ochrona kapitału', 1, 0.3, 'Kapitał nienaruszony. Ostrożność kosztuje najwyżej utraconą okazję.'));
  } else {
    const want = sideFor(t, x);
    const consistent = want === order.side;
    const counterTrend = (x.trend.dir === 'down' && order.side === 'long') || (x.trend.dir === 'up' && order.side === 'short');
    const ct = counterTrend && x.trend.strength !== 'weak';
    // 1. Context
    if (!consistent) {
      crit.push(C('context', 'Zgodność z obserwowanym kontekstem', 0, 0.26, t.expects === 'skip' ? `Teza „${t.label}” oznacza brak transakcji, a otworzyłeś ${order.side.toUpperCase()}.` : `Teza „${t.label}” w tej sytuacji nie uzasadnia pozycji ${order.side.toUpperCase()}${t.expects === 'range' ? ' (cena w środku zakresu lub po złej stronie)' : ''}.`));
    } else {
      const pro = sup.pro.length ? `Za: ${sup.pro.join('; ')}.` : '';
      const con = sup.con.length ? ` Przeciw: ${sup.con.join('; ')}.` : '';
      crit.push(C('context', 'Zgodność z obserwowanym kontekstem', sup.score, 0.26, `Dane wspierają tezę w ${Math.round(sup.score * 100)}%. ${pro}${con}`));
    }
    const ctxV = consistent ? sup.score : 0;
    if (ctxV < 0.35) {
      cap = Math.min(cap, 64);
      caps.push('Teza bez pokrycia w danych — dobre zarządzanie ryzykiem nie podniesie oceny powyżej C.');
    } else if (ctxV < 0.6) {
      cap = Math.min(cap, 79);
      caps.push('Teza tylko częściowo potwierdzona — ocena maksymalnie B.');
    }
    // 2. Risk per trade
    const rp = preview.riskPct;
    if (rp == null) {
      crit.push(C('risk', 'Ryzyko na transakcję', 0, 0.18, 'Nieokreślone — brak stopu. Nie wiesz, ile możesz stracić.'));
      cap = Math.min(cap, 54);
      caps.push('Brak stop-lossa — ocena maksymalnie D.');
    } else {
      const p = rp * 100;
      const v = p <= 1 ? 1 : p <= 2 ? 0.9 : p <= 3 ? 0.6 : p <= 5 ? 0.3 : 0;
      crit.push(C('risk', 'Ryzyko na transakcję', v, 0.18, `${p.toFixed(2)}% kapitału (z kosztami). ${p <= 2 ? 'W rozsądnym limicie 1–2%.' : p <= 5 ? 'Wysoko — kilka takich strat z rzędu mocno boli.' : 'Za dużo jak na jedną decyzję.'}`));
      if (p > 5) {
        cap = Math.min(cap, 54);
        caps.push('Ryzyko powyżej 5% kapitału — ocena maksymalnie D.');
      }
    }
    // 3. Stop quality
    if (order.stopPrice == null) crit.push(C('stop', 'Plan wyjścia: stop-loss', 0, 0.14, 'Brak stopu: to zakład, nie plan.'));
    else {
      const dAtr = Math.abs(preview.refPrice - order.stopPrice) / (x.atr || 1);
      let v = dAtr < 0.6 ? 0.35 : dAtr < 1 ? 0.75 : dAtr <= 3.5 ? 1 : dAtr <= 6 ? 0.7 : 0.4;
      let note = `Odległość ${dAtr.toFixed(1)} ATR. ${dAtr < 0.6 ? 'Stop w zwykłym szumie świec — łatwo go trafić przypadkiem.' : dAtr < 1 ? 'Dość ciasno.' : dAtr <= 3.5 ? 'Sensowny dystans względem zmienności.' : 'Bardzo daleko — duża strata przy pomyłce.'}`;
      const structural = order.side === 'long' ? order.stopPrice < x.swingLow : order.stopPrice > x.swingHigh;
      if (structural) note += ` Za ostatnim ${order.side === 'long' ? 'dołkiem' : 'szczytem'} (${(order.side === 'long' ? x.swingLow : x.swingHigh).toFixed(2)}) — tam teza przestaje działać.`;
      else {
        v = Math.min(v, 0.7);
        note += ` Przed ostatnim ${order.side === 'long' ? 'dołkiem' : 'szczytem'} — stop wypada w środku ostatnich wahań.`;
      }
      crit.push(C('stop', 'Plan wyjścia: stop-loss', v, 0.14, note));
    }
    // 4. Reward : risk
    if (preview.rewardRisk == null) crit.push(C('rr', 'Potencjalny zysk do ryzyka', 0.65, 0.1, 'Bez celu (take-profit). Dopuszczalne przy grze z trendem, ale nie znasz potencjału względem ryzyka.'));
    else {
      const rr = preview.rewardRisk;
      crit.push(C('rr', 'Potencjalny zysk do ryzyka', rr >= 2 ? 1 : rr >= 1.5 ? 0.8 : rr >= 1 ? 0.5 : 0.2, 0.1, `1 : ${rr.toFixed(2)}. ${rr >= 2 ? 'Możesz mylić się częściej, niż masz rację.' : rr >= 1 ? 'Wymaga wysokiej skuteczności.' : 'Ryzykujesz więcej, niż możesz zyskać.'}`));
    }
    // 5. Uncertainty — confidence vs evidence
    const diff = order.confidence - expectedConf;
    let unc = diff <= 0 ? 1 : diff === 1 ? 0.5 : 0.1;
    let uncNote = diff <= 0 ? `Deklarowana pewność (${['niska', 'średnia', 'wysoka'][order.confidence - 1]}) nie przekracza tego, co pokazują dane.` : `Pewność ${['niska', 'średnia', 'wysoka'][order.confidence - 1]}, a dane wspierają tezę w ${Math.round(sup.score * 100)}% — to nadmierna pewność.`;
    if (ct && order.confidence === 3) {
      unc = Math.min(unc, 0.3);
      uncNote = 'Wysoka pewność przy grze przeciw trendowi. Odwrócenie bez potwierdzenia jest z natury niepewne.';
    }
    crit.push(C('uncertainty', 'Niepewność: pewność a dowody', unc, 0.14, uncNote));
    // 6. Size vs conditions
    let size = 1;
    const sizeNotes: string[] = [];
    const riskPct = (preview.riskPct ?? 0.1) * 100;
    if (order.confidence === 1 && riskPct > 1) {
      size = Math.min(size, 0.4);
      sizeNotes.push('niska pewność, a ryzyko ponad 1%');
    }
    if (ct && riskPct > 1) {
      size = Math.min(size, 0.5);
      sizeNotes.push('gra przeciw trendowi z ryzykiem ponad 1%');
    }
    if (x.volRatio > 1.7 && order.sizeFrac >= 0.5) {
      size = Math.min(size, 0.4);
      sizeNotes.push('duża pozycja przy podwyższonej zmienności');
    }
    crit.push(C('sizing', 'Wielkość pozycji a warunki', size, 0.08, sizeNotes.length ? `Za dużo jak na warunki: ${sizeNotes.join('; ')}.` : 'Wielkość pozycji pasuje do pewności i zmienności.'));
    // 7. Plan consistency (management after entry)
    let plan = 1;
    const planNotes: string[] = [];
    for (const a of actions) {
      if (a.kind === 'stop') {
        if (a.to == null) {
          plan = Math.min(plan, 0);
          planNotes.push('usunąłeś stop po wejściu');
        } else if (a.from != null && (order.side === 'long' ? a.to < a.from : a.to > a.from)) {
          plan = Math.min(plan, 0.15);
          planNotes.push('odsunąłeś stop — zwiększyłeś ryzyko ponad plan');
        } else planNotes.push('przesunąłeś stop w stronę zysku (ochrona)');
      } else if (a.kind === 'close') {
        plan = Math.min(plan, 0.8);
        planNotes.push('zamknąłeś przed stopem i celem — w porządku, jeśli zmienił się kontekst');
      } else if (a.kind === 'target' && a.to == null) planNotes.push('usunąłeś cel');
    }
    crit.push(C('plan', 'Konsekwencja planu', plan, 0.07, planNotes.length ? `${planNotes.join('; ')}.` : 'Plan wykonany bez zmian.'));
    if (plan < 0.5) {
      cap = Math.min(cap, 64);
      caps.push('Ryzyko zwiększone po wejściu — ocena maksymalnie C.');
    }
    // 8. Costs vs risk
    const costShare = preview.riskUsd ? preview.estCosts / preview.riskUsd : 0;
    crit.push(C('costs', 'Koszty', costShare > 0.25 ? 0.4 : 1, 0.03, costShare > 0.25 ? `Opłaty i poślizg to ${Math.round(costShare * 100)}% planowanego ryzyka — stop bardzo blisko.` : `Szacowane koszty: ${preview.estCosts.toFixed(2)} USD (${Math.round(costShare * 100)}% ryzyka).`));
    const raw = Math.round((crit.reduce((a, c) => a + c.value * c.weight, 0) / crit.reduce((a, c) => a + c.weight, 0)) * 100);
    const score = Math.min(raw, cap);
    return { score, grade: gradeOf(score), criteria: crit, caps, support: sup, best, counterTrend: ct };
  }
  const score = Math.min(cap, Math.round((crit.reduce((a, c) => a + c.value * c.weight, 0) / crit.reduce((a, c) => a + c.weight, 0)) * 100));
  return { score, grade: gradeOf(score), criteria: crit, caps, support: sup, best, counterTrend: false };
}

const gradeOf = (s: number): ProcessEval['grade'] => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D');

export interface OutcomeEval {
  kind: 'gain' | 'loss' | 'flat' | 'skip';
  netPnl: number;
  pctOfCapital: number;
  r: number | null;
}

export function evaluateOutcome(trade: Trade | null, capital: number): OutcomeEval {
  if (!trade) return { kind: 'skip', netPnl: 0, pctOfCapital: 0, r: null };
  const kind = trade.netPnl > 0.01 ? 'gain' : trade.netPnl < -0.01 ? 'loss' : 'flat';
  return { kind, netPnl: trade.netPnl, pctOfCapital: (trade.netPnl / capital) * 100, r: trade.rMultiple };
}

export function quadrant(p: ProcessEval, o: OutcomeEval): string {
  const good = p.score >= 70;
  if (o.kind === 'skip') return good ? 'Świadome pominięcie. Rynek nie jest ci winien transakcji.' : 'Pominięcie bez spójnego uzasadnienia — następnym razem nazwij, czego brakuje.';
  if (good && o.kind === 'gain') return 'Dobry proces i dobry wynik. Pamiętaj: następnym razem ten sam proces może przegrać.';
  if (good) return 'Dobry proces, zły wynik. To się zdarza — liczy się proces powtarzany setki razy.';
  if (o.kind === 'gain') return 'Słaby proces, szczęśliwy wynik. Najgroźniejsza kombinacja: uczy złych nawyków.';
  return 'Słaby proces i zły wynik. Zacznij od tezy opartej na danych, stopu i wielkości pozycji.';
}

export interface Distribution {
  n: number;
  target: number;
  stop: number;
  other: number;
  avgR: number | null;
  avgPct: number;
  winRate: number;
  p10: number;
  p90: number;
}

/** LESSONS — plain-language commentary. `dist` = the same plan run through alternative futures (review only). */
export function lessons(x: MarketContext, order: OrderInput, p: ProcessEval, o: OutcomeEval, after: { maxUpPct: number; maxDownPct: number; endPct: number }, dist: Distribution | null): string[] {
  const L: string[] = [];
  const t = thesis(order.thesis);
  if (order.side === 'skip') L.push(`Zdecydowałeś: POMIŃ (teza: „${t.label}”).`);
  else L.push(`Zdecydowałeś: ${order.side === 'long' ? 'LONG' : 'SHORT'} z tezą „${t.label}”, pewność ${['niska', 'średnia', 'wysoka'][order.confidence - 1]}.`);
  if (p.best.id !== order.thesis && p.best.score >= 0.5) L.push(`Najmocniej dane wspierały: „${p.best.label}” (${Math.round(p.best.score * 100)}%). To nie znaczy, że tak się stanie — tylko że to była najlepiej udokumentowana hipoteza.`);
  if (p.counterTrend) L.push('Grałeś przeciw trendowi. Taka decyzja potrzebuje mocniejszego dowodu (klimaks, potwierdzenie) i mniejszego ryzyka niż gra z trendem.');
  L.push(`Po decyzji rynek: maksymalnie ${after.maxUpPct >= 0 ? '+' : ''}${after.maxUpPct.toFixed(1)}% / ${after.maxDownPct.toFixed(1)}%, na koniec ${after.endPct >= 0 ? '+' : ''}${after.endPct.toFixed(1)}%. Tego nie dało się wiedzieć w chwili decyzji — wynik nie potwierdza ani nie przekreśla procesu.`);
  if (dist && order.side !== 'skip') {
    const verdict = dist.avgR == null ? '' : dist.avgR > 0.15 ? 'W tym modelu plan miał dodatnią wartość oczekiwaną.' : dist.avgR < -0.15 ? 'W tym modelu plan średnio tracił.' : 'Średnio plan był bliski zera — o wyniku decydował głównie przypadek.';
    L.push(`Ten sam plan w ${dist.n} alternatywnych przyszłościach tego samego modelu: cel ${Math.round(dist.target * 100)}%, stop ${Math.round(dist.stop * 100)}%, inne zakończenie ${Math.round(dist.other * 100)}%; zysk w ${Math.round(dist.winRate * 100)}% przypadków${dist.avgR != null ? `, średnio ${dist.avgR >= 0 ? '+' : ''}${dist.avgR.toFixed(2)} R` : ''}. ${verdict}`);
  } else if (dist) {
    L.push(`W ${dist.n} alternatywnych przyszłościach cena na koniec rosła w ${Math.round(dist.winRate * 100)}% przypadków (10–90 percentyl: ${dist.p10.toFixed(1)}% … ${dist.p90.toFixed(1)}%). Tak wygląda niepewność, z którą pominięcie się mierzy.`);
  }
  if (o.kind === 'loss' && p.score >= 70) L.push('Strata przy dobrym procesie to koszt prowadzenia działalności, nie błąd.');
  if (o.kind === 'gain' && p.score < 55) L.push('Zysk przy słabym procesie jest niebezpieczny: utrwala nawyk, który na dłuższą metę kosztuje.');
  return L;
}

// ------------------------------------------------------------------------------------------------ legacy shim

/** M03-compatible combined evaluation (kept for callers that only need grade + quadrant). */
export function evaluate(order: OrderInput, preview: OrderPreview, trade: Trade | null, x: MarketContext, actions: ManagementAction[] = []) {
  const p = evaluateProcess(x, order, preview, actions);
  const o = evaluateOutcome(trade, 1);
  return { processScore: p.score, processGrade: p.grade, criteria: p.criteria, outcome: o.kind, quadrant: quadrant(p, o), process: p };
}
