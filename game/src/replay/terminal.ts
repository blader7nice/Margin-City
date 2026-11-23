import { analyze, type MarketContext } from './analysis';
import { CandleChart } from './chart';
import { evaluateOutcome, evaluateProcess, lessons, quadrant, sideFor, thesis, THESES } from './evaluate';
import { chartFeed } from './feed';
import { FAMILIES } from './market';
import { planDistribution } from './mc';
import { DAVE_RECORDING, libraryScenario, randomScenario, scenarioFromId } from './scenarios';
import { ReplaySession } from './session';
import type { OrderInput, Scenario, Side, ThesisId } from './types';

/**
 * Terminal B-12 2.0 (DOM + canvas). Two modes:
 *   story    — Dave's session: journal → decision → reveal → review → recording (plays once) → story continues.
 *   training — scenario library (12 situations × any seed, reproducible ids). Never touches the story.
 */

const CSS = `
#b12 { position: fixed; inset: 0; z-index: 20; display: none; background: radial-gradient(ellipse at 50% 30%, #0e1720, #05070a 75%); color: #c9d4df;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: clamp(15px, 0.45vw + 8px, 22px); line-height: 1.4; }
#b12.open { display: flex; flex-direction: column; overflow: hidden; }
#b12 [hidden] { display: none !important; }
#b12 .bar { height: auto; margin: 0; flex: none; display: flex; flex-wrap: wrap; gap: .35em 1em; align-items: center; padding: .55em 1em; border-bottom: 1px solid #1c2733; background: #070b10; font-family: ui-monospace, Menlo, monospace; font-size: .86em; }
#b12 .bar b { color: #e6edf3; font-weight: 600; }
#b12 .brand { color: #ffb35a; letter-spacing: .14em; font-weight: 700; }
#b12 .pill { border: 1px solid #2a3a4a; border-radius: 3px; padding: .1em .5em; color: #9fb0c0; }
#b12 .pill.warn { border-color: #8a5a1a; color: #ffb35a; background: rgba(255,179,90,.07); }
#b12 .pill.live { border-color: #1f6f66; color: #4fd1c5; }
#b12 .pill.story { border-color: #7a5a2a; color: #e9c48a; }
#b12 .spacer { flex: 1; }
#b12 .main { flex: 1 1 0; display: grid; grid-template-columns: minmax(0, 1fr) clamp(360px, 27vw, 640px); min-height: 0; overflow: hidden; position: relative; }
#b12 .chartWrap { position: relative; min-width: 0; border-right: 1px solid #1c2733; display: flex; flex-direction: column; }
#b12 .tools { flex: none; display: flex; gap: .4em; align-items: center; padding: .4em .7em; border-bottom: 1px solid #1c2733; font-size: .85em; flex-wrap: wrap; }
#b12 .tools button { padding: .2em .6em; }
#b12 .tools .sep { width: 1px; height: 1.3em; background: #24303d; margin: 0 .3em; }
#b12 .chartWrap > canvas { flex: 1 1 0; width: 100%; height: 0; min-height: 0; display: block; font-size: .82em; }
#b12 .chartFoot { display: flex; gap: .6em; align-items: center; padding: .45em .8em; border-top: 1px solid #1c2733; font-family: ui-monospace, monospace; font-size: .78em; color: #8593a3; flex-wrap: wrap; }
#b12 .side { overflow-y: auto; padding: .9em 1em 1.2em; display: flex; flex-direction: column; gap: .75em; background: #080c11; }
#b12 h3 { margin: 0; font-size: .78em; letter-spacing: .14em; text-transform: uppercase; color: #8593a3; font-weight: 700; }
#b12 h2 { margin: 0; font-size: 1.25em; color: #e6edf3; font-weight: 700; letter-spacing: normal; }
#b12 .row { display: flex; gap: .4em; flex-wrap: wrap; align-items: center; justify-content: flex-start; margin: 0; }
#b12 button { font: inherit; font-size: .92em; letter-spacing: .02em; color: #c9d4df; background: #0f161e; border: 1px solid #263544; border-radius: 4px; padding: .4em .7em; cursor: pointer; }
#b12 button:hover { border-color: #3d5266; }
#b12 button:disabled { opacity: .4; cursor: default; }
#b12 button:focus-visible, #b12 input:focus-visible { outline: 2px solid #4fd1c5; outline-offset: 1px; }
#b12 button.sel { border-color: #ffb35a; color: #ffd29a; background: rgba(255,179,90,.08); }
#b12 button.long.sel { border-color: #26a69a; color: #7fe6da; background: rgba(38,166,154,.14); }
#b12 button.short.sel { border-color: #ef5350; color: #ff9a98; background: rgba(239,83,80,.14); }
#b12 button.primary { margin-top: 0; background: #ffb35a; color: #1a1006; border-color: #ffb35a; font-weight: 700; padding: .6em 1em; }
#b12 .dir button { flex: 1; padding: .65em .4em; font-weight: 800; letter-spacing: .06em; }
#b12 .chips button { font-size: .86em; }
#b12 label { display: flex; justify-content: space-between; align-items: center; gap: .6em; color: #a9b7c6; }
#b12 input[type=number], #b12 input[type=text] { width: 8em; font: inherit; font-size: .92em; background: #0b1117; color: #e6edf3; border: 1px solid #263544; border-radius: 4px; padding: .3em .45em; font-family: ui-monospace, monospace; }
#b12 input[type=range] { width: 100%; accent-color: #ffb35a; }
#b12 .kv { display: grid; grid-template-columns: 1fr auto; gap: .2em .8em; font-family: ui-monospace, monospace; font-size: .9em; }
#b12 .kv span:nth-child(odd) { color: #8593a3; }
#b12 .kv span:nth-child(even) { text-align: right; color: #e6edf3; font-variant-numeric: tabular-nums; }
#b12 .err { color: #ff9a98; font-size: .9em; min-height: 1em; }
#b12 .note { color: #7d8b9a; font-size: .82em; line-height: 1.5; }
#b12 .brief { border-left: 3px solid #4fd1c5; padding: .4em .7em; background: rgba(79,209,197,.05); }
#b12 .journal { background: #f1e8d4; color: #2b2116; border-radius: 3px; padding: 1em 1.15em; font-family: 'Iowan Old Style', Georgia, serif; font-size: 1.02em; line-height: 1.55; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
#b12 .journal h4 { margin: 0 0 .25em; font-size: .85em; letter-spacing: .12em; text-transform: uppercase; color: #7a5a2a; font-family: ui-sans-serif, system-ui, sans-serif; }
#b12 .journal .date { font-size: .8em; color: #8a7a62; margin-bottom: .6em; font-family: ui-monospace, monospace; }
#b12 .journal p { margin: 0 0 .6em; }
#b12 .journal .sig { text-align: right; font-style: italic; }
#b12 .overlay { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; background: rgba(4,6,9,.86); padding: 1.2em; overflow-y: auto; z-index: 3; }
#b12 .overlay .box { max-width: 1180px; width: 100%; display: flex; flex-direction: column; gap: .9em; }
#b12 .cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1em; }
#b12 .card { width: auto; text-align: left; background: #0a0f15; border: 1px solid #1c2733; border-radius: 6px; padding: .9em 1em; display: flex; flex-direction: column; gap: .6em; }
#b12 .grade { display: flex; align-items: baseline; gap: .6em; }
#b12 .grade .big { font-size: 2.8em; font-weight: 800; color: #ffd29a; font-family: ui-monospace, monospace; line-height: 1; }
#b12 .crit { display: grid; grid-template-columns: 1.2em 1fr; gap: .25em .5em; font-size: .9em; line-height: 1.45; }
#b12 .crit .m { font-weight: 800; }
#b12 .good { color: #4fd1c5; } #b12 .warn { color: #ffb35a; } #b12 .bad { color: #ff7a78; } #b12 .info { color: #8593a3; }
#b12 .caps { color: #ffb35a; font-size: .86em; }
#b12 .quad { border-left: 3px solid #ffb35a; padding: .45em .7em; background: rgba(255,179,90,.06); color: #e6edf3; }
#b12 .lessons { margin: 0; padding-left: 1.1em; font-size: .92em; line-height: 1.5; display: flex; flex-direction: column; gap: .35em; }
#b12 .dave { border-left: 3px solid #b48a5a; padding: .5em .8em; background: rgba(180,138,90,.08); font-family: 'Iowan Old Style', Georgia, serif; font-size: 1em; line-height: 1.5; color: #e9dcc6; }
#b12 .pnl.pos { color: #4fd1c5; } #b12 .pnl.neg { color: #ff7a78; }
#b12 .overlay.lib { background: #05080c; }
#b12 .fams { display: grid; grid-template-columns: repeat(auto-fill, minmax(15em, 1fr)); gap: .6em; }
#b12 .fams button { text-align: left; display: flex; flex-direction: column; gap: .25em; padding: .7em .8em; }
#b12 .fams button b { color: #e6edf3; }
#b12 .fams button span { color: #9aa8b8; font-size: .9em; }
#b12 .fams button code { color: #6f7f90; font-size: .8em; }
#b12 table { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: .85em; width: 100%; }
#b12 td, #b12 th { padding: .25em .5em; border-bottom: 1px solid #16202a; text-align: left; }
#b12 th { color: #8593a3; font-weight: 600; }
#b12 .rec { position: absolute; inset: 0; background: #040608; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.4em; padding: 1.5em; z-index: 4; }
#b12 .rec canvas { flex: none; width: min(640px, 90vw); height: 120px; }
#b12 .rec .line { max-width: 760px; text-align: center; font-family: 'Iowan Old Style', Georgia, serif; font-size: clamp(18px, 2vw, 28px); color: #f1e8d4; min-height: 3em; }
#b12 .rec .who { font-family: ui-monospace, monospace; letter-spacing: .2em; color: #b48a5a; font-size: .85em; }
@media (max-width: 1100px) { #b12 .cols { grid-template-columns: 1fr; } }
@media (max-width: 860px) { #b12 .main { grid-template-columns: 1fr; grid-template-rows: 55% 45%; } #b12 .chartWrap { border-right: 0; border-bottom: 1px solid #1c2733; } }
`;

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`;
const HISTORY_KEY = 'mc.b12.history.v1';

export type TerminalMode = 'story' | 'training';

export interface TerminalCallbacks {
  /** Story: the archive recording has been viewed (independent of the trading result). */
  onStoryComplete: () => void;
  onClose: () => void;
  /** Telemetry hook. */
  onDecision?: (summary: Record<string, unknown>) => void;
}

interface HistoryRow {
  id: string;
  title: string;
  side: Side;
  grade: string;
  score: number;
  pnl: number;
  at: string;
}

export class Terminal {
  readonly root: HTMLDivElement;
  private chart: CandleChart;
  private session: ReplaySession | null = null;
  private ctx: MarketContext | null = null;
  private draft: OrderInput = { side: 'skip', sizeFrac: 0.2, stopPrice: null, takeProfit: null, thesis: 'no_edge', confidence: 2 };
  private useTp = false;
  private sizeMode: 'capital' | 'risk' = 'risk';
  private riskPct = 1;
  private ui = { ma20: true, ma50: true, volume: true };
  private playing = false;
  private playTimer = 0;
  private speed = 2;
  mode: TerminalMode = 'story';
  private storyDone = false;
  private els: Record<string, HTMLElement> = {};
  private cb: TerminalCallbacks;
  private raf = 0;
  private msg = '';

  constructor(cb: TerminalCallbacks) {
    this.cb = cb;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'b12';
    this.root.innerHTML = `
      <div class="bar">
        <span class="brand">TERMINAL B-12</span><span class="pill" data-k="mode"></span><span class="pill live">REPLAY</span>
        <span><b data-k="sym"></b> <span data-k="name"></span></span><span>TF <b data-k="tf"></b></span><span>UTC</span>
        <span>ID <b data-k="sid"></b></span>
        <span class="pill warn" data-k="synth">DANE SYNTETYCZNE</span>
        <span class="spacer"></span>
        <span>Saldo wirtualne <b data-k="bal"></b></span>
        <button data-a="library" title="Biblioteka scenariuszy treningowych">Scenariusze</button>
        <button data-a="close" title="Zamknij terminal (Esc)">✕</button>
      </div>
      <div class="main">
        <div class="chartWrap">
          <div class="tools">
            <button data-z="in" title="Przybliż (kółko myszy)">＋</button><button data-z="out" title="Oddal">－</button><button data-z="fit" title="Dopasuj (dwuklik)">Dopasuj</button>
            <span class="sep"></span>
            <button data-t="ma20">MA20</button><button data-t="ma50">MA50</button><button data-t="volume">Wolumen</button>
            <span class="sep"></span><span class="note">Kółko: zoom · przeciągnij: przesuń · przeciągnij linię STOP/CEL: zmień poziom</span>
          </div>
          <canvas></canvas>
          <div class="chartFoot"><span data-k="src"></span><span class="spacer"></span><span data-k="play"></span></div>
          <div class="overlay" data-k="ov" hidden><div class="box" data-k="ovBox"></div></div>
        </div>
        <div class="side" data-k="side"></div>
        <div class="overlay lib" data-k="lib" hidden><div class="box" data-k="libBox"></div></div>
      </div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.els[e.dataset.k!] = e));
    this.chart = new CandleChart(this.root.querySelector('canvas')!);
    this.chart.onLevelDrag = (id, price) => this.dragLevel(id, price);
    this.root.querySelector<HTMLButtonElement>('[data-a=close]')!.onclick = () => this.close();
    this.root.querySelector<HTMLButtonElement>('[data-a=library]')!.onclick = () => this.showLibrary();
    this.root.querySelectorAll<HTMLButtonElement>('[data-z]').forEach((b) => {
      b.onclick = () => (b.dataset.z === 'fit' ? this.chart.fit() : this.chart.zoom(b.dataset.z === 'in' ? 1 / 1.25 : 1.25));
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => {
      const k = b.dataset.t as keyof Terminal['ui'];
      b.classList.toggle('sel', this.ui[k]);
      b.onclick = () => {
        this.ui[k] = !this.ui[k];
        b.classList.toggle('sel', this.ui[k]);
        this.refresh();
      };
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.isOpen) return;
        e.stopPropagation();
        const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
        if (e.code === 'Escape') this.close();
        if (typing) return;
        if (this.session?.phase === 'revealing') {
          if (e.code === 'Space') {
            e.preventDefault();
            this.playing = !this.playing;
            this.renderPlay();
          }
          if (e.code === 'ArrowRight') this.stepOnce();
        }
      },
      true,
    );
    window.addEventListener('resize', () => this.isOpen && this.chart.resize());
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  /** Story session (Dave). After the recording, further openings are training. */
  openStory(scenario: Scenario): void {
    this.mode = 'story';
    this.start(scenario);
  }

  /** Training: a given scenario, or the library picker when none is given. */
  openTraining(scenario?: Scenario | null): void {
    this.mode = 'training';
    if (scenario) this.start(scenario);
    else {
      this.start(libraryScenario(FAMILIES[0].id, FAMILIES[0].seed));
      this.showLibrary();
    }
  }

  get storyCompleted(): boolean {
    return this.storyDone;
  }

  private start(scenario: Scenario): void {
    const s = new ReplaySession(scenario);
    this.session = s;
    this.ctx = analyze(s.visible(), scenario.decimals ?? 2);
    this.draft = { side: 'skip', sizeFrac: 0.2, stopPrice: null, takeProfit: null, thesis: 'no_edge', confidence: 2 };
    this.useTp = false;
    this.playing = false;
    this.msg = '';
    const m = scenario.dataset.meta;
    this.els.mode.textContent = this.mode === 'story' ? 'FABUŁA · DZIENNIK D.' : 'TRENING';
    this.els.mode.className = `pill ${this.mode === 'story' ? 'story' : ''}`;
    this.els.sym.textContent = m.symbol;
    this.els.name.textContent = m.name;
    this.els.tf.textContent = m.timeframe;
    this.els.sid.textContent = scenario.id;
    this.els.synth.hidden = !m.synthetic;
    this.els.bal.textContent = money(scenario.capital);
    this.els.src.textContent = `Źródło: ${m.source} · ${m.license}`;
    (this.root.querySelector('[data-a=library]') as HTMLElement).hidden = this.mode === 'story';
    this.els.ov.hidden = true;
    this.els.ov.dataset.shown = '0';
    this.els.lib.hidden = true;
    this.root.classList.add('open');
    this.chart.resize();
    this.chart.fit();
    if (scenario.journal && this.mode === 'story') this.showJournal();
    else this.renderTicket();
    this.refresh();
    cancelAnimationFrame(this.raf);
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      this.tick(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  close(): void {
    this.root.classList.remove('open');
    cancelAnimationFrame(this.raf);
    this.cb.onClose();
  }

  // ------------------------------------------------------------------ library (training)
  private showLibrary(): void {
    const hist = this.history();
    this.els.libBox.innerHTML = `
      <div class="row"><h2>Symulator B-12 · trening</h2><span class="spacer"></span><button data-a="libClose">Zamknij listę</button></div>
      <div class="note">12 sytuacji rynkowych. Opis mówi tylko, co widać na wykresie — nie, co stanie się dalej. Każdy scenariusz ma ID (rodzina-seed):
        ten sam ID zawsze daje te same świece. Przyszłość jest losowana dla każdego seeda — bez z góry ustalonego wyniku. Dane syntetyczne, wirtualne pieniądze.</div>
      <div class="fams">${FAMILIES.map((f) => `<button data-fam="${f.id}"><b>${f.title}</b><span>${f.brief}</span><code>${f.id}-${f.seed}</code></button>`).join('')}</div>
      <div class="row"><button class="primary" data-a="random">Losowy scenariusz</button><span class="spacer"></span>
        <input type="text" data-in="sid" placeholder="np. breakout-4421" style="width:14em"><button data-a="openId">Otwórz ID</button></div>
      <div class="err" data-k="libErr"></div>
      ${hist.length ? `<h3>Twoje ostatnie sesje (lokalnie)</h3><table><tr><th>ID</th><th>Sytuacja</th><th>Decyzja</th><th>Proces</th><th>Wynik</th></tr>${hist
        .slice(-10)
        .reverse()
        .map((h) => `<tr><td>${h.id}</td><td>${h.title}</td><td>${h.side === 'skip' ? 'POMIŃ' : h.side.toUpperCase()}</td><td>${h.grade} · ${h.score}</td><td class="pnl ${h.pnl < 0 ? 'neg' : 'pos'}">${money(h.pnl)}</td></tr>`)
        .join('')}</table>` : ''}`;
    this.els.lib.hidden = false;
    this.els.ov.hidden = true;
    const box = this.els.libBox;
    box.querySelector<HTMLButtonElement>('[data-a=libClose]')!.onclick = () => (this.els.lib.hidden = true);
    box.querySelectorAll<HTMLButtonElement>('[data-fam]').forEach((b) => {
      b.onclick = () => {
        const f = FAMILIES.find((x) => x.id === b.dataset.fam)!;
        this.mode = 'training';
        this.start(libraryScenario(f.id, f.seed));
      };
    });
    box.querySelector<HTMLButtonElement>('[data-a=random]')!.onclick = () => {
      this.mode = 'training';
      this.start(randomScenario());
    };
    const idIn = box.querySelector<HTMLInputElement>('[data-in=sid]')!;
    const openId = () => {
      const sc = scenarioFromId(idIn.value);
      if (!sc) {
        box.querySelector<HTMLElement>('[data-k=libErr]')!.textContent = 'Nieznane ID. Format: rodzina-seed, np. panic-6637.';
        return;
      }
      this.mode = 'training';
      this.start(sc);
    };
    box.querySelector<HTMLButtonElement>('[data-a=openId]')!.onclick = openId;
    idIn.onkeydown = (e) => e.key === 'Enter' && openId();
  }

  private history(): HistoryRow[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryRow[];
    } catch {
      return [];
    }
  }

  private pushHistory(row: HistoryRow): void {
    try {
      const h = this.history();
      h.push(row);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-30)));
    } catch {
      /* storage blocked: history is a convenience only */
    }
  }

  // ------------------------------------------------------------------ analysis views
  private showJournal(): void {
    const j = this.session!.scenario.journal!;
    this.els.side.innerHTML = `
      <div class="journal"><h4>${j.title}</h4><div class="date">${j.dateLabel}</div>
      ${j.paragraphs.map((p) => `<p>${p}</p>`).join('')}<div class="sig">${j.signature}</div></div>
      <button class="primary" data-a="toTicket">Analizuj wykres</button>
      <div class="note">Wykres pokazuje tylko to, co Dave widział w chwili decyzji. Przyszłe świece są ukryte — także dla skali osi i średnich.</div>`;
    this.els.side.querySelector<HTMLButtonElement>('[data-a=toTicket]')!.onclick = () => this.renderTicket();
  }

  private structuralStop(side: 'long' | 'short'): number {
    const x = this.ctx!;
    const d = 10 ** (this.session!.scenario.decimals ?? 2);
    return Math.round((side === 'long' ? x.swingLow - 0.15 * x.atr : x.swingHigh + 0.15 * x.atr) * d) / d;
  }

  private applySizing(): void {
    const o = this.draft;
    if (this.sizeMode === 'risk' && o.side !== 'skip' && o.stopPrice != null) o.sizeFrac = this.session!.sizeForRisk(this.riskPct / 100, o.side, o.stopPrice);
  }

  private renderTicket(): void {
    const s = this.session!;
    if (s.phase !== 'analysis') return;
    const sc = s.scenario;
    const dec = sc.decimals ?? 2;
    const o = this.draft;
    this.applySizing();
    const pv = s.preview({ ...o, takeProfit: this.useTp ? o.takeProfit : null });
    const trade = o.side !== 'skip';
    const th = thesis(o.thesis);
    const hint = trade && sideFor(th, this.ctx!) !== o.side ? `<div class="note warn">Uwaga: teza „${th.label}” nie wskazuje teraz na ${o.side === 'long' ? 'LONG' : 'SHORT'}.</div>` : '';
    const tpGain = pv.rewardRisk != null && pv.riskUsd != null && o.takeProfit != null ? pv.qty * Math.abs(o.takeProfit - pv.refPrice) - pv.estCosts : null;
    const brief = this.mode === 'training' && sc.brief ? `<div class="brief"><b>${sc.title}</b><div class="note" style="color:#a9b7c6">${sc.brief}</div></div>` : '';
    this.els.side.innerHTML = `${brief}
      <h3>1 · Co widzisz? (teza)</h3><div class="row chips">${THESES.map((t) => `<button data-th="${t.id}" class="${o.thesis === t.id ? 'sel' : ''}">${t.label}</button>`).join('')}</div>
      <h3>2 · Jak bardzo jesteś pewien?</h3><div class="row">${[1, 2, 3].map((c) => `<button data-cf="${c}" class="${o.confidence === c ? 'sel' : ''}">${['Niska', 'Średnia', 'Wysoka'][c - 1]}</button>`).join('')}</div>
      <h3>3 · Decyzja</h3>
      <div class="row dir"><button class="long ${o.side === 'long' ? 'sel' : ''}" data-sd="long">LONG</button><button class="short ${o.side === 'short' ? 'sel' : ''}" data-sd="short">SHORT</button><button class="${o.side === 'skip' ? 'sel' : ''}" data-sd="skip">POMIŃ</button></div>
      ${hint}
      ${
        trade
          ? `<label>Stop-loss <input type="number" step="${1 / 10 ** dec}" value="${o.stopPrice ?? ''}" data-in="stop" placeholder="brak"></label>
      <div class="row"><button data-a="stopWick">${o.side === 'long' ? 'Za ostatnim dołkiem' : 'Za ostatnim szczytem'}</button><button data-a="stopAtr">1,5 × ATR</button><button data-a="noStop">Bez stopu</button></div>
      <h3>Wielkość pozycji</h3>
      <div class="row"><button data-sm="risk" class="${this.sizeMode === 'risk' ? 'sel' : ''}">wg ryzyka %</button><button data-sm="capital" class="${this.sizeMode === 'capital' ? 'sel' : ''}">% kapitału</button></div>
      ${
        this.sizeMode === 'risk'
          ? `<label>Ryzyko <b>${this.riskPct.toFixed(2)}% kapitału</b></label><input type="range" min="0.25" max="3" step="0.25" value="${this.riskPct}" data-in="riskPct" ${o.stopPrice == null ? 'disabled' : ''}>
             <div class="note">${o.stopPrice == null ? 'Ustaw stop, żeby policzyć wielkość z ryzyka.' : `Pozycja: ${Math.round(o.sizeFrac * 100)}% kapitału${o.sizeFrac >= 0.999 ? ' (limit 100% — bez dźwigni)' : ''}.`}</div>`
          : `<label>Pozycja <b>${Math.round(o.sizeFrac * 100)}% kapitału</b></label><input type="range" min="5" max="100" step="5" value="${Math.round(o.sizeFrac * 100)}" data-in="size">`
      }
      <label><span><input type="checkbox" data-in="useTp" ${this.useTp ? 'checked' : ''}> Cel (take-profit)</span><input type="number" step="${1 / 10 ** dec}" value="${o.takeProfit ?? ''}" data-in="tp" ${this.useTp ? '' : 'disabled'}></label>
      <div class="row"><button data-a="tp2r" ${o.stopPrice == null ? 'disabled' : ''}>Cel = 2R</button></div>
      <div class="kv">
        <span>Cena odniesienia</span><span>${pv.refPrice.toFixed(dec)}</span>
        <span>Wartość pozycji · ilość</span><span>${money(pv.notional)} · ${pv.qty.toFixed(pv.qty < 10 ? 3 : 1)}</span>
        <span>Ryzyko (z kosztami)</span><span>${pv.riskUsd != null ? `${money(pv.riskUsd)} · ${(pv.riskPct! * 100).toFixed(2)}%` : 'nieokreślone'}</span>
        <span>Strata przy stopie (netto)</span><span class="pnl neg">${pv.riskUsd != null ? money(-pv.riskUsd) : '—'}</span>
        <span>Zysk przy celu (netto)</span><span class="pnl pos">${tpGain != null && this.useTp ? money(tpGain) : '—'}</span>
        <span>Zysk : ryzyko</span><span>${pv.rewardRisk != null && this.useTp ? `1 : ${pv.rewardRisk.toFixed(2)}` : '—'}</span>
        <span>Opłaty + poślizg (szac.)</span><span>${money(pv.estCosts)}</span>
        <span>ATR(14)</span><span>${this.ctx!.atr.toFixed(dec)} (${this.ctx!.atrPct.toFixed(2)}%)</span>
      </div>`
          : `<div class="note">Pominięcie nie zmienia salda. Zobaczysz, co stało się dalej, i ocenę procesu — pominięcie też jest oceniane.</div>`
      }
      <div class="err">${pv.errors.join(' ')}</div>
      <button class="primary" data-a="submit" ${pv.errors.length ? 'disabled' : ''}>Potwierdź decyzję</button>
      <div class="note">Wejście: otwarcie następnej świecy + poślizg ${sc.costs.slippageBps} bps. Opłata ${sc.costs.feeBps} bps na stronę. Jeśli jedna świeca dotknie stopu i celu, liczymy stop (wariant ostrożny). Bez dźwigni, bez prawdziwych pieniędzy.</div>`;
    const side = this.els.side;
    const rerender = () => (this.renderTicket(), this.refresh());
    side.querySelectorAll<HTMLButtonElement>('[data-th]').forEach((b) => (b.onclick = () => ((o.thesis = b.dataset.th as ThesisId), rerender())));
    side.querySelectorAll<HTMLButtonElement>('[data-cf]').forEach((b) => (b.onclick = () => ((o.confidence = Number(b.dataset.cf) as 1 | 2 | 3), rerender())));
    side.querySelectorAll<HTMLButtonElement>('[data-sm]').forEach((b) => (b.onclick = () => ((this.sizeMode = b.dataset.sm as 'risk' | 'capital'), rerender())));
    side.querySelectorAll<HTMLButtonElement>('[data-sd]').forEach(
      (b) =>
        (b.onclick = () => {
          const sd = b.dataset.sd as Side;
          if (sd !== o.side && sd !== 'skip') {
            o.stopPrice = this.structuralStop(sd);
            if (this.useTp) o.takeProfit = this.twoR(sd, o.stopPrice);
          }
          o.side = sd;
          rerender();
        }),
    );
    const num = (sel: string, f: (v: number | null) => void) => {
      const el = side.querySelector<HTMLInputElement>(sel);
      if (el) el.onchange = () => (f(el.value === '' ? null : Number(el.value)), rerender());
    };
    num('[data-in=stop]', (v) => (o.stopPrice = v));
    num('[data-in=tp]', (v) => (o.takeProfit = v));
    const size = side.querySelector<HTMLInputElement>('[data-in=size]');
    if (size) size.oninput = () => ((o.sizeFrac = Number(size.value) / 100), rerender());
    const risk = side.querySelector<HTMLInputElement>('[data-in=riskPct]');
    if (risk) risk.oninput = () => ((this.riskPct = Number(risk.value)), rerender());
    const useTp = side.querySelector<HTMLInputElement>('[data-in=useTp]');
    if (useTp)
      useTp.onchange = () => {
        this.useTp = useTp.checked;
        if (this.useTp && o.side !== 'skip') o.takeProfit = this.twoR(o.side, o.stopPrice ?? this.structuralStop(o.side));
        rerender();
      };
    const click = (sel: string, f: () => void) => {
      const el = side.querySelector<HTMLButtonElement>(sel);
      if (el) el.onclick = () => (f(), rerender());
    };
    click('[data-a=stopWick]', () => (o.stopPrice = this.structuralStop(o.side as 'long' | 'short')));
    click('[data-a=stopAtr]', () => {
      const dd = 10 ** dec;
      o.stopPrice = Math.round((s.decisionCandle.c + (o.side === 'long' ? -1.5 : 1.5) * this.ctx!.atr) * dd) / dd;
    });
    click('[data-a=noStop]', () => (o.stopPrice = null));
    click('[data-a=tp2r]', () => {
      this.useTp = true;
      o.takeProfit = this.twoR(o.side as 'long' | 'short', o.stopPrice!);
    });
    side.querySelector<HTMLButtonElement>('[data-a=submit]')!.onclick = () => this.submit();
  }

  private twoR(side: 'long' | 'short', stop: number): number {
    const ref = this.session!.decisionCandle.c;
    const d = 10 ** (this.session!.scenario.decimals ?? 2);
    return Math.round((ref + (side === 'long' ? 2 : -2) * Math.abs(ref - stop)) * d) / d;
  }

  private dragLevel(id: string, price: number): void {
    const s = this.session;
    if (!s) return;
    const d = 10 ** (s.scenario.decimals ?? 2);
    const p = Math.round(price * d) / d;
    if (s.phase === 'analysis') {
      if (id === 'stop') this.draft.stopPrice = p;
      if (id === 'target') this.draft.takeProfit = p;
      this.renderTicket();
    } else if (s.phase === 'revealing' && (id === 'stop' || id === 'target')) {
      this.msg = s.modify(id, p) ?? '';
      this.renderManage();
    }
    this.refresh();
  }

  private submit(): void {
    const s = this.session!;
    const o = this.draft;
    this.applySizing();
    const errs = s.submit({ ...o, stopPrice: o.side === 'skip' ? null : o.stopPrice, takeProfit: o.side === 'skip' || !this.useTp ? null : o.takeProfit });
    if (errs.length) return;
    this.playing = true;
    this.els.side.innerHTML = `<h3>Odtwarzanie</h3><div data-k="manage"></div>
      <div class="row"><button data-a="pp">❚❚ Pauza</button><button data-a="st">Krok ▸</button><button data-a="end">Do końca ⏭</button></div>
      <div class="row">${[1, 2, 4].map((v) => `<button data-sp="${v}" class="${this.speed === v ? 'sel' : ''}">${v}×</button>`).join('')}</div>
      <div class="note">Spacja: pauza · →: krok. Możesz przesuwać STOP i CEL na wykresie albo zamknąć pozycję — jak na prawdziwej platformie. Każda zmiana trafia do oceny procesu.</div>`;
    const side = this.els.side;
    this.els.manage = side.querySelector('[data-k=manage]')!;
    side.querySelector<HTMLButtonElement>('[data-a=pp]')!.onclick = () => ((this.playing = !this.playing), this.renderPlay());
    side.querySelector<HTMLButtonElement>('[data-a=st]')!.onclick = () => this.stepOnce();
    side.querySelector<HTMLButtonElement>('[data-a=end]')!.onclick = () => {
      s.runToEnd();
      this.refresh();
      this.showReview();
    };
    side.querySelectorAll<HTMLButtonElement>('[data-sp]').forEach((b) => (b.onclick = () => ((this.speed = Number(b.dataset.sp)), side.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('sel', x === b)))));
    this.renderManage();
    this.renderPlay();
    this.refresh();
  }

  /** Live position panel (rebuilt when its content changes; buttons keep working). */
  private renderManage(): void {
    const s = this.session!;
    const el = this.els.manage;
    if (!el || s.phase !== 'revealing') return;
    const dec = s.scenario.decimals ?? 2;
    const o = s.order!;
    const pos = s.position();
    const c = s.candles[s.cursor];
    let html = `<div class="kv"><span>Cena</span><span>${c.c.toFixed(dec)}</span>`;
    if (o.side === 'skip') html += `<span>Pozycja</span><span>brak (POMIŃ)</span></div>`;
    else if (!pos && !s.trade) html += `<span>Zlecenie</span><span>${o.side.toUpperCase()} — wejście na otwarciu następnej świecy</span></div>`;
    else if (pos) {
      html += `<span>Pozycja</span><span class="${pos.side === 'long' ? 'good' : 'bad'}">${pos.side.toUpperCase()} @ ${pos.entryPrice.toFixed(dec)}</span>
        <span>Wynik netto (bieżący)</span><span class="pnl ${pos.unrealized >= 0 ? 'pos' : 'neg'}">${money(pos.unrealized)}${pos.r != null ? ` · ${pos.r >= 0 ? '+' : ''}${pos.r.toFixed(2)} R` : ''}</span>
        <span>Stop · cel</span><span>${pos.stop != null ? pos.stop.toFixed(dec) : '—'} · ${pos.target != null ? pos.target.toFixed(dec) : '—'}</span></div>
        <div class="row"><button data-a="be">Stop na wejście (BE)</button><button data-a="closePos" ${pos.closing ? 'disabled' : ''}>${pos.closing ? 'Zamykanie…' : 'Zamknij pozycję'}</button></div>`;
    } else if (s.trade) {
      const tr = s.trade;
      html += `<span>Pozycja</span><span>zamknięta (${exitName(tr.exitReason)})</span><span>Wynik netto</span><span class="pnl ${tr.netPnl >= 0 ? 'pos' : 'neg'}">${money(tr.netPnl)}</span></div>`;
    }
    if (s.actions.length) html += `<div class="note">Zmiany planu: ${s.actions.map((a) => (a.kind === 'close' ? 'zamknięcie' : `${a.kind === 'stop' ? 'stop' : 'cel'} ${a.from?.toFixed(dec) ?? '—'} → ${a.to?.toFixed(dec) ?? '—'}`)).join('; ')}</div>`;
    if (this.msg) html += `<div class="err">${this.msg}</div>`;
    if (el.dataset.html === html) return;
    el.dataset.html = html;
    el.innerHTML = html;
    el.querySelector<HTMLButtonElement>('[data-a=be]')?.addEventListener('click', () => {
      const p = s.position();
      if (p) this.msg = s.modify('stop', Math.round(p.entryPrice * 10 ** dec) / 10 ** dec) ?? '';
      this.renderManage();
      this.refresh();
    });
    el.querySelector<HTMLButtonElement>('[data-a=closePos]')?.addEventListener('click', () => {
      s.requestClose();
      this.renderManage();
    });
  }

  private stepOnce(): void {
    const s = this.session!;
    const more = s.step();
    this.msg = '';
    this.refresh();
    this.renderManage();
    if (!more || s.phase === 'review') {
      s.runToEnd();
      this.refresh();
      this.showReview();
    }
  }

  private renderPlay(): void {
    const pp = this.els.side.querySelector<HTMLButtonElement>('[data-a=pp]');
    if (pp) pp.textContent = this.playing ? '❚❚ Pauza' : '▶ Odtwarzaj';
    const s = this.session!;
    this.els.play.textContent = s.phase === 'revealing' ? `świeca ${s.cursor - s.scenario.decisionIndex} / ${s.scenario.horizon}` : s.phase === 'review' ? 'replay zakończony' : 'analiza · przyszłość ukryta';
  }

  private tick(t: number): void {
    const s = this.session;
    if (!s) return;
    if (s.phase === 'revealing' && this.playing && t - this.playTimer > 650 / this.speed) {
      this.playTimer = t;
      this.stepOnce();
    }
  }

  // ------------------------------------------------------------------ review
  private showReview(): void {
    if (this.els.ov.dataset.shown === '1') return;
    const s = this.session!;
    const o = s.order!;
    const x = this.ctx!;
    const sc = s.scenario;
    const dec = sc.decimals ?? 2;
    const pv = s.preview(o);
    const proc = evaluateProcess(x, o, pv, s.actions);
    const out = evaluateOutcome(s.trade, sc.capital);
    const mv = s.afterMove()!;
    let dist = null;
    try {
      dist = planDistribution(sc, o, 200, s.phase);
    } catch {
      dist = null;
    }
    const L = lessons(x, o, proc, out, mv, dist);
    const tr = s.trade;
    this.cb.onDecision?.({
      mode: this.mode,
      scenario: sc.id,
      family: sc.family ?? 'story',
      side: o.side,
      thesis: o.thesis,
      confidence: o.confidence,
      sizeFrac: +o.sizeFrac.toFixed(3),
      riskPct: pv.riskPct != null ? +(pv.riskPct * 100).toFixed(2) : null,
      stop: o.stopPrice,
      tp: o.takeProfit,
      actions: s.actions.length,
      grade: proc.grade,
      score: proc.score,
      netPnl: +(tr?.netPnl ?? 0).toFixed(2),
      exit: tr?.exitReason ?? 'skip',
    });
    if (this.mode === 'training') this.pushHistory({ id: sc.id, title: sc.title, side: o.side, grade: proc.grade, score: proc.score, pnl: tr?.netPnl ?? 0, at: new Date().toISOString() });
    const crit = proc.criteria.map((c) => `<span class="m ${c.mark}">${{ good: '✓', warn: '!', bad: '✗', info: 'i' }[c.mark]}</span><span><b>${c.label}</b> · ${c.note}</span>`).join('');
    const author = this.mode === 'story' && sc.authorNote ? `<div class="dave">${sc.authorNote.map((p) => `<p style="margin:0 0 .5em">${p}</p>`).join('')}<div style="text-align:right;font-style:italic">— D.</div></div>` : '';
    const story = this.mode === 'story';
    this.els.ovBox.innerHTML = `
      <div class="row"><h2>${sc.title}</h2><span class="note">ID ${sc.id} · ${sc.dataset.meta.synthetic ? 'dane syntetyczne' : sc.dataset.meta.source}</span></div>
      <div class="row actions">${
        story && !this.storyDone
          ? '<button class="primary" data-a="rec">Odtwórz nagranie z archiwum</button>'
          : `<button class="primary" data-a="again">Powtórz ten scenariusz</button><button data-a="lib2">Inny scenariusz</button><button data-a="closeAll">Zamknij terminal</button>`
      }</div>
      <div class="quad">${quadrant(proc, out)}</div>
      <div class="cols">
        <div class="card"><h3>1 · Proces decyzji</h3>
          <div class="grade"><span class="big">${proc.grade}</span><span>${proc.score}/100</span></div>
          ${proc.caps.length ? `<div class="caps">${proc.caps.join('<br>')}</div>` : ''}
          <div class="crit">${crit}</div>
          <div class="note">Ocena procesu korzysta wyłącznie z informacji dostępnych w chwili decyzji (i z chwil, w których zmieniałeś plan). Wynik nie ma na nią wpływu.</div>
        </div>
        <div class="card"><h3>2 · Wynik finansowy</h3>
          <div style="font-size:1.5em;font-family:ui-monospace,monospace" class="pnl ${out.netPnl < 0 ? 'neg' : 'pos'}">${tr ? `${money(tr.netPnl)} (${pct(out.pctOfCapital)})` : 'brak pozycji · $0,00'}</div>
          ${
            tr
              ? `<div class="kv"><span>Wejście → wyjście</span><span>${tr.entryPrice.toFixed(dec)} → ${tr.exitPrice.toFixed(dec)}</span><span>Powód wyjścia</span><span>${exitName(tr.exitReason)}</span>
              <span>Brutto · opłaty</span><span>${money(tr.grossPnl)} · ${money(tr.fees)}</span><span>Poślizg (koszt)</span><span>${money(tr.slippageCost)}</span>
              <span>Wynik w R</span><span>${tr.rMultiple != null ? `${tr.rMultiple >= 0 ? '+' : ''}${tr.rMultiple.toFixed(2)} R` : '—'}</span><span>Maks. przeciw / za tobą</span><span>${tr.mae.toFixed(2)}% / ${tr.mfe.toFixed(2)}%</span></div>`
              : ''
          }
          <div class="kv"><span>Rynek po decyzji</span><span>max ${pct(mv.maxUpPct, 1)} · min ${pct(mv.maxDownPct, 1)}</span><span>Na koniec sesji</span><span>${pct(mv.endPct, 1)}</span></div>
          ${dist ? `<div class="kv"><span>Ten plan w ${dist.n} alternatywnych przyszłościach</span><span>${o.side === 'skip' ? `wzrost w ${Math.round(dist.winRate * 100)}%` : `zysk w ${Math.round(dist.winRate * 100)}%${dist.avgR != null ? ` · śr. ${dist.avgR >= 0 ? '+' : ''}${dist.avgR.toFixed(2)} R` : ''}`}</span></div>` : ''}
        </div>
        <div class="card"><h3>3 · Komentarz</h3>
          <div><b>Co było widać w chwili decyzji:</b><ul class="lessons">${x.observations.map((t) => `<li>${t}</li>`).join('')}</ul></div>
          <ul class="lessons">${L.map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>
      </div>
      ${author}
      <div class="note">To ćwiczenie procesu decyzyjnego na danych syntetycznych, nie porada inwestycyjna. Żadne pieniądze nie są prawdziwe.</div>`;
    this.els.ov.hidden = false;
    this.els.ov.dataset.shown = '1';
    this.els.manage = undefined as unknown as HTMLElement;
    this.els.side.innerHTML = `<h3>Replay zakończony</h3><div class="kv"><span>Decyzja</span><span>${o.side === 'skip' ? 'POMIŃ' : o.side.toUpperCase()}</span><span>Proces</span><span>${proc.grade} · ${proc.score}/100</span><span>Wynik netto</span><span class="pnl ${(tr?.netPnl ?? 0) < 0 ? 'neg' : 'pos'}">${tr ? money(tr.netPnl) : '$0,00'}</span></div>
      <button data-a="showReview">Pokaż ocenę</button><div class="note">Ukryj ocenę, żeby obejrzeć świece po decyzji (najedź na wykres).</div>`;
    this.els.side.querySelector<HTMLButtonElement>('[data-a=showReview]')!.onclick = () => (this.els.ov.hidden = false);
    const box = this.els.ovBox;
    const hide = document.createElement('button');
    hide.textContent = 'Obejrzyj wykres';
    hide.onclick = () => (this.els.ov.hidden = true);
    box.querySelector('.row.actions')?.appendChild(hide);
    box.querySelector<HTMLButtonElement>('[data-a=rec]')?.addEventListener('click', () => this.playRecording());
    box.querySelector<HTMLButtonElement>('[data-a=again]')?.addEventListener('click', () => this.start(scenarioFromId(sc.id) ?? sc));
    box.querySelector<HTMLButtonElement>('[data-a=lib2]')?.addEventListener('click', () => {
      this.mode = 'training';
      this.showLibrary();
    });
    box.querySelector<HTMLButtonElement>('[data-a=closeAll]')?.addEventListener('click', () => this.close());
    this.renderPlay();
  }

  private playRecording(): void {
    const rec = document.createElement('div');
    rec.className = 'rec';
    rec.innerHTML = `<div class="who">NAGRANIE · ARCHIWUM B-12 · D.</div><canvas width="1280" height="240"></canvas><div class="line"></div><button data-a="next">Dalej ▸</button>`;
    this.root.querySelector('.chartWrap')!.appendChild(rec);
    const cv = rec.querySelector('canvas')!;
    const ctx = cv.getContext('2d')!;
    const line = rec.querySelector<HTMLDivElement>('.line')!;
    let i = 0;
    let t0 = performance.now();
    const show = () => {
      line.textContent = DAVE_RECORDING[i];
      t0 = performance.now();
    };
    show();
    let raf = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, 1280, 240);
      ctx.strokeStyle = '#b48a5a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const talk = Math.min(1, (t - t0) / 300) * (0.6 + 0.4 * Math.sin(t / 90));
      for (let x = 0; x <= 1280; x += 6) {
        const env = Math.sin((x / 1280) * Math.PI);
        const y = 120 + Math.sin(x * 0.05 + t / 120) * Math.sin(x * 0.013 + t / 400) * 80 * env * talk;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (t - t0 > 4200) next();
    };
    const next = () => {
      i++;
      if (i >= DAVE_RECORDING.length) {
        cancelAnimationFrame(raf);
        rec.remove();
        // The recording plays exactly once per playthrough: from now on the terminal opens in training mode.
        this.storyDone = true;
        this.els.ov.hidden = true;
        this.els.ov.dataset.shown = '0';
        this.close();
        this.cb.onStoryComplete();
        return;
      }
      show();
    };
    rec.querySelector<HTMLButtonElement>('[data-a=next]')!.onclick = next;
    raf = requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------------ chart refresh
  private refresh(): void {
    const s = this.session;
    if (!s) return;
    this.chart.set(chartFeed(s, { draft: this.draft, useTp: this.useTp, ...this.ui }));
    this.renderPlay();
  }
}

function exitName(r: string): string {
  return ({ stop: 'stop-loss', target: 'cel', horizon: 'koniec sesji', gap_stop: 'luka przez stop', manual: 'zamknięcie ręczne' } as Record<string, string>)[r] ?? r;
}
