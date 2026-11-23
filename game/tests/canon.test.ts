import { describe, expect, it } from 'vitest';
import { OPENING_MESSAGES } from '../src/story/opening';
import { DAVE_RECORDING, storyScenario } from '../src/replay/scenarios';

/** Guards for approved canon (Master Bible v1.2, decisions I-1 … I-4). Text may evolve; these facts may not. */
describe('Story canon guards', () => {
  it("I-1: the night opens with Dave's automatic dead man's switch carrying a private brothers' hint", () => {
    const dave = OPENING_MESSAGES.find((m) => m.from === 'Dave')!;
    expect(dave.meta).toMatch(/automatycznie/);
    expect(dave.meta).toMatch(/nie potwierdził aktywności/);
    expect(dave.lines.join(' ')).toMatch(/bibliotek/i);
    expect(dave.lines.join(' ')).toMatch(/trzeciej/);
    expect(dave.lines.join(' ')).toMatch(/B-12/);
  });

  it('I-1 / I-3: K. warns that the archive is liquidated before dawn; her identity is not revealed', () => {
    const k = OPENING_MESSAGES.find((m) => m.meta.includes('K.'))!;
    expect(k.from).not.toMatch(/Kate/);
    expect(k.lines.join(' ')).toMatch(/likwid/);
    expect(k.lines.join(' ')).toMatch(/Inspektor/);
  });

  it('I-1: Dave did not leave a complete set of evidence; the recording points to the next clue', () => {
    const rec = DAVE_RECORDING.join(' ');
    expect(rec).toMatch(/Nie mam jeszcze dowodów/);
    expect(rec).toMatch(/The Paper District/);
    expect(rec).toMatch(/trzeciej drogi/);
  });

  it('I-4: the recording references the brothers\' conflict without revealing its true reason yet', () => {
    const rec = DAVE_RECORDING.join(' ').toLowerCase();
    expect(rec).toMatch(/przepraszam/);
    expect(rec).not.toMatch(/chroni|ochroni|odsunąłem cię/);
  });

  it('Dave is an innocent analyst of the legitimate model (no trading, no orchestration)', () => {
    const note = storyScenario().authorNote!.join(' ');
    expect(note).toMatch(/nie otworzyłem pozycji/);
    expect(DAVE_RECORDING.join(' ')).toMatch(/MIRROR miał rozpoznawać strach tłumu/);
  });
});
