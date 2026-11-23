import { session0417 } from './synthetic';
import { buildScenarioData, FAMILIES, parseScenarioId, type FamilyId } from './market';
import type { Scenario } from './types';

/**
 * Story scenarios. Text is canon-safe: Dave wrote everything BEFORE his disappearance (conditional voice),
 * his model was built for a legitimate purpose, and the abuse is fictional — no claim about real markets.
 */

export const DAVE_RECORDING: string[] = [
  'Leon. Jeśli słuchasz tego nagrania, to znaczy, że nie odezwałem się na czas.',
  'Przepraszam. Za to, jak ostatnio rozmawialiśmy — i za to, że wciągam cię w to teraz.',
  'MIRROR miał rozpoznawać strach tłumu, żeby ludzie nie podejmowali decyzji w panice.',
  'Ktoś nauczył go czegoś innego: jak ten strach podsycać, i kiedy.',
  'Nie mam jeszcze dowodów, które obronią się przed prawnikami. Mam dziennik.',
  'Zostawiłem go tam, gdzie papier jest ważniejszy niż serwery. The Paper District.',
  'Szukaj trzeciej drogi.',
];

export function storyScenario(): Scenario {
  const dataset = session0417();
  const dc = dataset.candles[59];
  return {
    id: 'b12-0417',
    title: 'Sesja 0417 — Kapitulacja',
    dataset,
    decisionIndex: 59,
    horizon: 24,
    window: 60,
    capital: 10000,
    costs: { feeBps: 10, slippageBps: 5 },
    decimals: 2,
    journal: {
      id: 'dave-14',
      title: 'Dziennik D. · wpis 14',
      dateLabel: 'Sesja 0417 (dane syntetyczne)',
      paragraphs: [
        'Leon — jeśli to czytasz, znalazłeś B-12. Zrobię to tak jak kiedyś w bibliotece: zagadką, nie wykładem.',
        'To zapis sesji z czasu, gdy pracowałem nad MIRROR. Model miał rozpoznawać panikę tłumu — po to, żeby ostrzegać ludzi, zanim zdecydują w strachu.',
        'Zanim klikniesz, odpowiedz sobie na trzy pytania: co widzisz, gdzie się mylisz, ile możesz stracić.',
        'Pominięcie też jest decyzją. Archiwum otworzy się bez względu na wynik — liczy się, jak myślisz.',
      ],
      signature: '— D.',
    },
    authorNote: [
      'Tego dnia nie otworzyłem pozycji. Wykres krzyczał „okazja”, ale nie umiałem powiedzieć, gdzie się mylę. Bez tego to nie jest decyzja, tylko zakład.',
      'Kilka tygodni później zobaczyłem w logach MIRROR, że ktoś oznacza takie świece nie po to, żeby ostrzegać — tylko żeby je wywoływać.',
    ],
    // Zero-drift approximation of the story generator's future (for the review panel only).
    model: {
      stateAtDecision: { logP: Math.log(dc.c), sigmaMult: 1.3, t: dc.t + 14400, lastRet: 0 },
      future: { bars: 28, vol: 0.017, rho: 0, refDrift: 0, driftSd: 0, volStart: 1.4, volume: 1.4 },
      sim: { timeframe: '4h', baseVolume: 18500, decimals: 2 },
    },
  };
}

/** Training library scenario: family + seed → identical data every time (reproducible for tests and playtests). */
export function libraryScenario(family: FamilyId, seed: number): Scenario {
  const b = buildScenarioData(family, seed);
  return {
    id: b.meta.id,
    title: b.family.title,
    family: b.family.id,
    brief: b.family.brief,
    dataset: { meta: b.meta, candles: b.candles },
    decisionIndex: b.decisionIndex,
    horizon: b.candles.length - 1 - b.decisionIndex,
    window: b.decisionIndex + 1,
    capital: 10000,
    costs: { feeBps: 10, slippageBps: 5 },
    decimals: b.decimals,
    model: b.model,
  };
}

/** "family-seed" → scenario (null if the id is invalid). */
export function scenarioFromId(id: string): Scenario | null {
  const p = parseScenarioId(id);
  return p ? libraryScenario(p.family, p.seed) : null;
}

/** Random training scenario (any family). */
export function randomScenario(rnd: () => number = Math.random): Scenario {
  const f = FAMILIES[Math.floor(rnd() * FAMILIES.length)];
  return libraryScenario(f.id, 1 + Math.floor(rnd() * 99999));
}

/** M03 compatibility: numeric training seed → a library scenario. */
export function trainingScenario(seed: number): Scenario {
  return libraryScenario(FAMILIES[seed % FAMILIES.length].id, seed);
}
