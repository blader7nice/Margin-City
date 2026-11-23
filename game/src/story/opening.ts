/**
 * Opening of The Last Shift — canon I-1 (approved 2026-11-23):
 *  - Dave's DEAD MAN'S SWITCH: an automatic message, sent because Dave stopped confirming he is fine.
 *    It carries a private hint only the brothers understand (the library, "the third way").
 *  - Kate's warning, signed only "K." (her identity is not revealed yet): the old archive is liquidated at dawn.
 * Text lives here, in one place, so narrative edits never touch game code.
 */
export interface PhoneMessage {
  from: string;
  meta: string;
  lines: string[];
}

export const OPENING_MESSAGES: PhoneMessage[] = [
  {
    from: 'Dave',
    meta: 'Wiadomość zaplanowana · wysłana automatycznie: nadawca nie potwierdził aktywności od 72 godzin',
    lines: [
      'Leo. Skoro to czytasz, przestałem się odzywać — i to nie jest przypadek.',
      'Pamiętasz bibliotekę? Kiedy dwie drogi były pilnowane, szukaliśmy trzeciej.',
      'Stara hala notowań. Archiwum B-12. Zostawiłem tam coś, czego nie mogłem wysłać.',
      'Nikomu nie mów. Jeszcze nie.',
    ],
  },
  {
    from: 'Nieznany numer',
    meta: 'podpis: K.',
    lines: [
      'Archiwum B-12 likwidują jutro o 06:00. Po tym nie będzie czego szukać.',
      'Likwidację nadzoruje Inspektor. Jeśli idziesz — idź dziś w nocy.',
      'Nie odpisuj na ten numer.',
    ],
  },
];

/** Shows the phone messages over the start screen; resolves when the player continues (any key / click / Esc). */
export function showOpening(root: HTMLElement): Promise<void> {
  const existing = document.getElementById('opening');
  if (existing) return new Promise(() => undefined); // already showing (e.g. Space re-activated the start button)
  (document.activeElement as HTMLElement | null)?.blur();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'opening';
    el.innerHTML = `<div class="phone"><div class="clock">23:47</div><div class="msgs"></div>
      <div class="hint">Spacja / klik — dalej · Esc — pomiń</div></div>`;
    root.appendChild(el);
    const box = el.querySelector<HTMLDivElement>('.msgs')!;
    let i = 0;
    const next = () => {
      if (i >= OPENING_MESSAGES.length) return finish();
      const m = OPENING_MESSAGES[i++];
      const card = document.createElement('div');
      card.className = 'msg';
      card.innerHTML = `<div class="from">${m.from}</div><div class="meta">${m.meta}</div>${m.lines.map((l) => `<p>${l}</p>`).join('')}`;
      box.appendChild(card);
      requestAnimationFrame(() => card.classList.add('in'));
    };
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.code === 'Escape') finish();
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') next();
    };
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
      resolve();
    };
    window.addEventListener('keydown', onKey, true);
    el.addEventListener('click', next);
    next();
  });
}

export const OPENING_CSS = `
#opening { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 40%, rgba(10,14,20,.92), rgba(2,3,5,.98)); transition: opacity .45s; cursor: pointer; }
#opening.out { opacity: 0; }
#opening .phone { width: min(30rem, 92vw); border: 1px solid rgba(255,210,150,.18); border-radius: 1.4rem; padding: 1.4rem 1.2rem 1rem; background: #0b0f14; box-shadow: 0 30px 80px rgba(0,0,0,.6); font-family: ui-sans-serif, system-ui, sans-serif; }
#opening .clock { text-align: center; color: #8b98a8; font-size: .8rem; letter-spacing: .2em; margin-bottom: .8rem; font-family: ui-monospace, monospace; }
#opening .msgs { display: flex; flex-direction: column; gap: .9rem; min-height: 12rem; }
#opening .msg { background: #141b23; border-radius: .9rem; padding: .8rem 1rem; color: #e6edf3; opacity: 0; transform: translateY(8px); transition: opacity .5s, transform .5s; }
#opening .msg.in { opacity: 1; transform: none; }
#opening .from { font-weight: 700; color: #ffd29a; }
#opening .meta { font-size: .72rem; color: #8b98a8; margin: .15rem 0 .5rem; font-family: ui-monospace, monospace; }
#opening .msg p { margin: .25rem 0; line-height: 1.45; font-size: .95rem; }
#opening .hint { text-align: center; color: #6f7d8c; font-size: .72rem; margin-top: .9rem; }
`;
