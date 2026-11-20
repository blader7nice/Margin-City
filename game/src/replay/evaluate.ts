import type { OrderInput, ThesisId, Trade } from './types';
import type { OrderPreview } from './session';

/**
 * Process evaluation: the decision is graded on its quality, separately from the outcome.
 * Grades are heuristics for learning, not investment advice.
 */

export type Mark = 'good' | 'warn' | 'bad' | 'info';
export interface Criterion {
  id: string;
  label: string;
  mark: Mark;
  note: string;
}

export interface Evaluation {
  processScore: number; // 0..100
  processGrade: 'A' | 'B' | 'C' | 'D';
  criteria: Criterion[];
  outcome: 'gain' | 'loss' | 'flat' | 'skip';
  quadrant: string;
}

export const THESES: { id: ThesisId; label: string; expects: 'long' | 'short' | 'skip' | 'any' }[] = [
  { id: 'trend_up', label: 'Trend wzrostowy trwa', expects: 'long' },
  { id: 'trend_down', label: 'Trend spadkowy trwa', expects: 'short' },
  { id: 'capitulation_reversal', label: 'Kapitulacja — możliwe odbicie', expects: 'long' },
  { id: 'breakdown', label: 'Przełamanie — spadki przyspieszą', expects: 'short' },
  { id: 'range', label: 'Konsolidacja / brak kierunku', expects: 'skip' },
  { id: 'no_edge', label: 'Nie widzę przewagi', expects: 'skip' },
];

const WEIGHT: Record<Mark, number> = { good: 1, warn: 0.5, bad: 0, info: 1 };

export function evaluate(order: OrderInput, preview: OrderPreview, trade: Trade | null): Evaluation {
  const c: Criterion[] = [];
  const thesis = THESES.find((t) => t.id === order.thesis)!;
  if (order.side === 'skip') {
    const consistent = thesis.expects === 'skip';
    c.push({
      id: 'consistency',
      label: 'Zgodność tezy z decyzją',
      mark: consistent ? 'good' : 'warn',
      note: consistent
        ? 'Brak przewagi = brak transakcji. To pełnoprawna decyzja.'
        : `Twoja teza („${thesis.label}”) sugerowała pozycję, a jednak ją pominąłeś. Jeśli to ostrożność — opisz, czego zabrakło.`,
    });
    c.push({ id: 'risk', label: 'Ryzyko', mark: 'good', note: 'Kapitał nienaruszony. Ostrożność kosztuje tylko utraconą szansę.' });
  } else {
    // Exit plan
    c.push(
      order.stopPrice != null
        ? { id: 'stop', label: 'Plan wyjścia (stop-loss)', mark: 'good', note: 'Wiedziałeś przed wejściem, gdzie się mylisz.' }
        : { id: 'stop', label: 'Plan wyjścia (stop-loss)', mark: 'bad', note: 'Bez stopu nie wiesz, ile możesz stracić. To zakład, nie decyzja.' },
    );
    // Risk per trade
    const rp = preview.riskPct;
    if (rp == null) c.push({ id: 'risk', label: 'Ryzyko na transakcję', mark: 'bad', note: 'Nieokreślone (brak stopu).' });
    else {
      const pct = rp * 100;
      const mark: Mark = pct <= 1 ? 'good' : pct <= 2 ? 'good' : pct <= 5 ? 'warn' : 'bad';
      c.push({ id: 'risk', label: 'Ryzyko na transakcję', mark, note: `${pct.toFixed(2)}% kapitału. ${pct <= 2 ? 'Mieści się w rozsądnym limicie 1–2%.' : pct <= 5 ? 'Wysoko — kilka takich porażek z rzędu boli.' : 'Za dużo jak na jedną decyzję.'}` });
    }
    // Thesis vs action
    const consistent = thesis.expects === order.side || thesis.expects === 'any';
    c.push({
      id: 'consistency',
      label: 'Zgodność tezy z decyzją',
      mark: consistent ? 'good' : 'bad',
      note: consistent ? `Teza („${thesis.label}”) i kierunek się zgadzają.` : `Teza („${thesis.label}”) nie uzasadnia pozycji ${order.side.toUpperCase()}.`,
    });
    // Confidence vs size
    const big = order.sizeFrac >= 0.5;
    if (order.confidence === 1 && big) c.push({ id: 'sizing', label: 'Pewność a wielkość', mark: 'bad', note: 'Niska pewność, duża pozycja — rozmiar powinien rosnąć z jakością tezy, nie z nadzieją.' });
    else if (order.confidence === 3 && !big) c.push({ id: 'sizing', label: 'Pewność a wielkość', mark: 'good', note: 'Wysoka pewność, a mimo to umiarkowana pozycja — dyscyplina.' });
    else c.push({ id: 'sizing', label: 'Pewność a wielkość', mark: 'good', note: 'Wielkość pozycji pasuje do deklarowanej pewności.' });
    // Reward : risk
    if (preview.rewardRisk == null) c.push({ id: 'rr', label: 'Zysk do ryzyka', mark: 'info', note: 'Bez take-profit. To dopuszczalne, ale warto wiedzieć, na co liczysz.' });
    else {
      const rr = preview.rewardRisk;
      c.push({ id: 'rr', label: 'Zysk do ryzyka', mark: rr >= 2 ? 'good' : rr >= 1 ? 'warn' : 'bad', note: `1 : ${rr.toFixed(2)}. ${rr >= 2 ? 'Możesz mylić się częściej niż mieć rację.' : rr >= 1 ? 'Potrzebujesz wysokiej skuteczności.' : 'Ryzykujesz więcej, niż możesz zyskać.'}` });
    }
    // Costs vs risk
    if (preview.riskUsd != null && preview.estCosts > preview.riskUsd * 0.25)
      c.push({ id: 'costs', label: 'Koszty', mark: 'warn', note: 'Opłaty i poślizg zjadają dużą część planowanego ryzyka — stop jest bardzo blisko.' });
  }
  const scored = c.filter((x) => x.mark !== 'info');
  const processScore = Math.round((scored.reduce((a, x) => a + WEIGHT[x.mark], 0) / Math.max(1, scored.length)) * 100);
  const processGrade = processScore >= 85 ? 'A' : processScore >= 70 ? 'B' : processScore >= 50 ? 'C' : 'D';
  const good = processScore >= 70;
  let outcome: Evaluation['outcome'] = 'skip';
  if (trade) outcome = trade.netPnl > 0.01 ? 'gain' : trade.netPnl < -0.01 ? 'loss' : 'flat';
  let quadrant: string;
  if (outcome === 'skip') quadrant = good ? 'Świadome pominięcie. Rynek nie jest ci winien transakcji.' : 'Pominąłeś bez jasnego powodu — następnym razem nazwij, czego brakuje.';
  else if (good && outcome === 'gain') quadrant = 'Dobra decyzja i dobry wynik.';
  else if (good) quadrant = 'Dobra decyzja, zły wynik. To się zdarza — liczy się proces powtarzany setki razy.';
  else if (outcome === 'gain') quadrant = 'Słaby proces, szczęśliwy wynik. Najgroźniejsza kombinacja: uczy złych nawyków.';
  else quadrant = 'Słaby proces i zły wynik. Zacznij od stopu i wielkości pozycji.';
  return { processScore, processGrade, criteria: c, outcome, quadrant };
}
