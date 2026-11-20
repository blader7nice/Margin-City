import { session0417, trainingSession } from './synthetic';
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
  return {
    id: 'b12-0417',
    title: 'Sesja 0417 — Kapitulacja',
    dataset: session0417(),
    decisionIndex: 59,
    horizon: 24,
    window: 60,
    capital: 10000,
    costs: { feeBps: 10, slippageBps: 5 },
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
  };
}

export function trainingScenario(seed: number): Scenario {
  const dataset = trainingSession(seed);
  return {
    id: `training-${seed}`,
    title: `Sesja treningowa #${seed}`,
    dataset,
    decisionIndex: 59,
    horizon: 24,
    window: 60,
    capital: 10000,
    costs: { feeBps: 10, slippageBps: 5 },
  };
}
