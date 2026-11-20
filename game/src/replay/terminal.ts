import { CandleChart, type Level, type Marker } from './chart';
import { evaluate, THESES } from './evaluate';
import { ReplaySession } from './session';
import { DAVE_RECORDING, trainingScenario } from './scenarios';
import type { OrderInput, Scenario, Side, ThesisId } from './types';

/**
 * Terminal B-12 UI (DOM + canvas overlay). Modular: give it any Scenario; it calls back when the player is done.
 * Flow: journal → analysis (order ticket) → reveal (step / play) → review (process + outcome) → [recording] → close.
 */

const CSS = `
#b12 { position: fixed; inset: 0; z-index: 20; display: none; background: radial-gradient(ellipse at 50% 30%, #0e1720, #05070a 75%); color: #c9d4df;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 13px; }
#b12.open { display: flex; flex-direction: column; overflow: hidden; }
#b12 [hidden] { display: none !important; }
#b12 .bar { flex: none; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #1c2733; background: #070b10; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
#b12 .bar b { color: #e6edf3; font-weight: 600; }
#b12 .brand { color: #ffb35a; letter-spacing: .14em; }
#b12 .pill { border: 1px solid #2a3a4a; border-radius: 3px; padding: 2px 7px; color: #9fb0c0; }
#b12 .pill.warn { border-color: #8a5a1a; color: #ffb35a; background: rgba(255,179,90,.07); }
#b12 .pill.live { border-color: #1f6f66; color: #4fd1c5; }
#b12 .spacer { flex: 1; }
#b12 .main { flex: 1 1 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 0; overflow: hidden; }
#b12 .chartWrap { position: relative; min-width: 0; border-right: 1px solid #1c2733; display: flex; flex-direction: column; }
#b12 .chartWrap > canvas { flex: 1 1 0; width: 100%; height: 0; min-height: 0; display: block; }
#b12 .chartFoot { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid #1c2733; font-family: ui-monospace, monospace; font-size: 11px; color: #7d8a99; flex-wrap: wrap; }
#b12 .side { overflow-y: auto; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 12px; background: #080c11; }
#b12 h3 { margin: 0; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #7d8a99; font-weight: 600; }
#b12 .row { display: flex; gap: 6px; flex-wrap: wrap; }
#b12 button { font: inherit; color: #c9d4df; background: #0f161e; border: 1px solid #263544; border-radius: 3px; padding: 6px 10px; cursor: pointer; }
#b12 button:hover { border-color: #3d5266; }
#b12 button:focus-visible, #b12 input:focus-visible { outline: 2px solid #4fd1c5; outline-offset: 1px; }
#b12 button.sel { border-color: #ffb35a; color: #ffd29a; background: rgba(255,179,90,.08); }
#b12 button.long.sel { border-color: #26a69a; color: #7fe6da; background: rgba(38,166,154,.12); }
#b12 button.short.sel { border-color: #ef5350; color: #ff9a98; background: rgba(239,83,80,.12); }
#b12 button.primary { background: #ffb35a; color: #1a1006; border-color: #ffb35a; font-weight: 700; padding: 9px 14px; }
#b12 button.primary:disabled { opacity: .4; cursor: default; }
#b12 .dir button { flex: 1; padding: 10px 6px; font-weight: 700; letter-spacing: .06em; }
#b12 label { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #9fb0c0; }
#b12 input[type=number] { width: 110px; background: #0b1117; color: #e6edf3; border: 1px solid #263544; border-radius: 3px; padding: 5px 7px; font-family: ui-monospace, monospace; }
#b12 input[type=range] { width: 100%; accent-color: #ffb35a; }
#b12 .kv { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; font-family: ui-monospace, monospace; font-size: 12px; }
#b12 .kv span:nth-child(odd) { color: #7d8a99; }
#b12 .kv span:nth-child(even) { text-align: right; color: #e6edf3; font-variant-numeric: tabular-nums; }
#b12 .err { color: #ff9a98; font-size: 12px; min-height: 1em; }
#b12 .note { color: #6f7d8c; font-size: 11px; line-height: 1.5; }
#b12 .journal { background: #f1e8d4; color: #2b2116; border-radius: 3px; padding: 16px 18px; font-family: 'Iowan Old Style', Georgia, serif; font-size: 15px; line-height: 1.55; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
#b12 .journal h4 { margin: 0 0 4px; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #7a5a2a; font-family: ui-sans-serif, system-ui, sans-serif; }
#b12 .journal .date { font-size: 12px; color: #8a7a62; margin-bottom: 10px; font-family: ui-monospace, monospace; }
#b12 .journal p { margin: 0 0 10px; }
#b12 .journal .sig { text-align: right; font-style: italic; }
#b12 .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(4,6,9,.78); padding: 16px; }
#b12 .overlay .box { max-width: 560px; width: 100%; display: flex; flex-direction: column; gap: 14px; }
#b12 .grade { display: flex; align-items: baseline; gap: 12px; }
#b12 .grade .big { font-size: 40px; font-weight: 800; color: #ffd29a; font-family: ui-monospace, monospace; }
#b12 .crit { display: grid; grid-template-columns: 18px 1fr; gap: 2px 8px; font-size: 12px; line-height: 1.45; }
#b12 .crit .m { font-weight: 800; }
#b12 .crit .good { color: #4fd1c5; } #b12 .crit .warn { color: #ffb35a; } #b12 .crit .bad { color: #ff7a78; } #b12 .crit .info { color: #7d8a99; }
#b12 .quad { border-left: 3px solid #ffb35a; padding: 6px 10px; background: rgba(255,179,90,.06); color: #e6edf3; }
#b12 .dave { border-left: 3px solid #b48a5a; padding: 8px 12px; background: rgba(180,138,90,.08); font-family: 'Iowan Old Style', Georgia, serif; font-size: 14px; line-height: 1.5; color: #e9dcc6; }
#b12 .pnl.pos { color: #4fd1c5; } #b12 .pnl.neg { color: #ff7a78; }
#b12 .rec { position: absolute; inset: 0; background: #040608; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px; }
#b12 .rec canvas { flex: none; width: min(640px, 90vw); height: 120px; }
#b12 .rec .line { max-width: 720px; text-align: center; font-family: 'Iowan Old Style', Georgia, serif; font-size: clamp(16px, 2.2vw, 22px); color: #f1e8d4; min-height: 3em; }
#b12 .rec .who { font-family: ui-monospace, monospace; letter-spacing: .2em; color: #b48a5a; font-size: 12px; }
@media (max-width: 860px) { #b12 .main { grid-template-columns: 1fr; grid-template-rows: 55% 45%; } #b12 .chartWrap { border-right: 0; border-bottom: 1px solid #1c2733; } }
`;

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;

export interface TerminalCallbacks {
  /** Story: the archive / recording have been viewed (independent of the trading result). */
  onStoryComplete: () => void;
  onClose: () => void;
  /** Telemetry hook. */
  onDecision?: (summary: Record<string, unknown>) => void;
}

export class Terminal {
  readonly root: HTMLDivElement;
  private chart: CandleChart;
  private session!: ReplaySession;
  private order: OrderInput = { side: 'skip', sizeFrac: 0.2, stopPrice: null, takeProfit: null, thesis: 'no_edge', confidence: 2 };
  private useTp = false;
  private playing = false;
  private playTimer = 0;
  private speed = 2;
  private story = true;
  private storyDone = false;
  private els: Record<string, HTMLElement> = {};
  private cb: TerminalCallbacks;
  private raf = 0;

  constructor(cb: TerminalCallbacks) {
    this.cb = cb;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'b12';
    this.root.innerHTML = `
      <div class="bar">
        <span class="brand">TERMINAL B-12</span><span class="pill live">REPLAY</span>
        <span>Instrument <b data-k="sym"></b></span><span>Rynek <b data-k="mkt"></b></span>
        <span>TF <b data-k="tf"></b></span><span>Strefa <b>UTC</b></span>
        <span class="pill warn" data-k="synth">DANE SYNTETYCZNE</span>
        <span class="spacer"></span>
        <span>Saldo wirtualne <b data-k="bal"></b></span>
        <button data-a="close" title="Zamknij terminal (Esc)">✕</button>
      </div>
      <div class="main">
        <div class="chartWrap">
          <canvas></canvas>
          <div class="chartFoot"><span data-k="src"></span><span class="spacer"></span><span data-k="play"></span></div>
          <div class="overlay" data-k="ov" hidden><div class="box" data-k="ovBox"></div></div>
        </div>
        <div class="side" data-k="side"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.els[e.dataset.k!] = e));
    this.chart = new CandleChart(this.root.querySelector('canvas')!);
    this.chart.onLevelDrag = (id, price) => {
      if (this.session.phase !== 'analysis') return;
      const p = Math.round(price * 100) / 100;
      if (id === 'stop') this.order.stopPrice = p;
      if (id === 'target') this.order.takeProfit = p;
      this.renderTicket();
      this.refresh();
    };
    this.root.querySelector<HTMLButtonElement>('[data-a=close]')!.onclick = () => this.close();
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      e.stopPropagation();
      if (e.code === 'Escape') this.close();
      if (this.session?.phase === 'revealing') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.playing = !this.playing;
          this.renderPlay();
        }
        if (e.code === 'ArrowRight') this.stepOnce();
      }
    }, true);
    window.addEventListener('resize', () => this.isOpen && this.chart.resize());
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  open(scenario: Scenario, story: boolean): void {
    this.story = story;
    this.session = new ReplaySession(scenario);
    const ref = this.session.decisionCandle.c;
    this.order = { side: 'skip', sizeFrac: 0.2, stopPrice: Math.round(ref * 0.95 * 100) / 100, takeProfit: null, thesis: 'no_edge', confidence: 2 };
    this.useTp = false;
    this.playing = false;
    const m = scenario.dataset.meta;
    this.els.sym.textContent = m.symbol;
    this.els.mkt.textContent = m.market;
    this.els.tf.textContent = m.timeframe;
    this.els.synth.hidden = !m.synthetic;
    this.els.bal.textContent = money(scenario.capital);
    this.els.src.textContent = `Źródło: ${m.source} · ${m.license}`;
    this.root.classList.add('open');
    this.chart.resize();
    if (scenario.journal && story) this.showJournal();
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

  // ------------------------------------------------------------------ views
  private showJournal(): void {
    const j = this.session.scenario.journal!;
    this.els.side.innerHTML = `
      <div class="journal"><h4>${j.title}</h4><div class="date">${j.dateLabel}</div>
      ${j.paragraphs.map((p) => `<p>${p}</p>`).join('')}<div class="sig">${j.signature}</div></div>
      <button class="primary" data-a="toTicket">Analizuj wykres</button>
      <div class="note">Wykres po lewej pokazuje tylko to, co Dave widział w chwili decyzji. Przyszłe świece są ukryte do momentu potwierdzenia — także dla skali osi.</div>`;
    this.els.side.querySelector<HTMLButtonElement>('[data-a=toTicket]')!.onclick = () => this.renderTicket();
  }

  private renderTicket(): void {
    const s = this.session;
    if (s.phase !== 'analysis') return;
    const o = this.order;
    const pv = s.preview(o);
    const theses = THESES.map((t) => `<button data-th="${t.id}" class="${o.thesis === t.id ? 'sel' : ''}">${t.label}</button>`).join('');
    const conf = [1, 2, 3].map((c) => `<button data-cf="${c}" class="${o.confidence === c ? 'sel' : ''}">${['Niska', 'Średnia', 'Wysoka'][c - 1]}</button>`).join('');
    const trade = o.side !== 'skip';
    this.els.side.innerHTML = `
      <h3>1 · Co widzisz?</h3><div class="row">${theses}</div>
      <h3>2 · Pewność</h3><div class="row">${conf}</div>
      <h3>3 · Decyzja</h3>
      <div class="row dir"><button class="long ${o.side === 'long' ? 'sel' : ''}" data-sd="long">LONG</button><button class="short ${o.side === 'short' ? 'sel' : ''}" data-sd="short">SHORT</button><button class="${o.side === 'skip' ? 'sel' : ''}" data-sd="skip">POMIŃ</button></div>
      ${
        trade
          ? `<label>Wielkość pozycji <b>${Math.round(o.sizeFrac * 100)}% kapitału</b></label>
      <input type="range" min="5" max="100" step="5" value="${Math.round(o.sizeFrac * 100)}" data-in="size">
      <label>Stop-loss <input type="number" step="0.01" value="${o.stopPrice ?? ''}" data-in="stop" placeholder="brak"></label>
      <div class="row"><button data-a="stopWick">${o.side === 'long' ? 'Pod ostatnim dołkiem' : 'Nad ostatnim szczytem'}</button><button data-a="noStop">Bez stopu</button></div>
      <label><span><input type="checkbox" data-in="useTp" ${this.useTp ? 'checked' : ''}> Take-profit</span><input type="number" step="0.01" value="${o.takeProfit ?? ''}" data-in="tp" ${this.useTp ? '' : 'disabled'}></label>
      <div class="kv">
        <span>Cena odniesienia</span><span>${pv.refPrice.toFixed(2)}</span>
        <span>Wartość pozycji</span><span>${money(pv.notional)}</span>
        <span>Ilość</span><span>${pv.qty.toFixed(3)}</span>
        <span>Ryzyko</span><span>${pv.riskUsd != null ? `${money(pv.riskUsd)} · ${(pv.riskPct! * 100).toFixed(2)}%` : 'nieokreślone'}</span>
        <span>Zysk : ryzyko</span><span>${pv.rewardRisk != null ? `1 : ${pv.rewardRisk.toFixed(2)}` : '—'}</span>
        <span>Szac. opłaty + poślizg</span><span>${money(pv.estCosts)}</span>
      </div>`
          : `<div class="note">Pominięcie nie zmienia salda. Zobaczysz, co stało się dalej, i ocenę procesu.</div>`
      }
      <div class="err">${pv.errors.join(' ')}</div>
      <button class="primary" data-a="submit" ${pv.errors.length ? 'disabled' : ''}>Potwierdź decyzję</button>
      <div class="note">Wejście: otwarcie następnej świecy + poślizg ${s.scenario.costs.slippageBps} bps. Opłata ${s.scenario.costs.feeBps} bps na stronę. Jeśli jedna świeca dotknie stopu i celu, liczymy stop (wariant ostrożny). Bez dźwigni, bez prawdziwych pieniędzy.</div>`;
    const side = this.els.side;
    side.querySelectorAll<HTMLButtonElement>('[data-th]').forEach((b) => (b.onclick = () => ((o.thesis = b.dataset.th as ThesisId), this.renderTicket())));
    side.querySelectorAll<HTMLButtonElement>('[data-cf]').forEach((b) => (b.onclick = () => ((o.confidence = Number(b.dataset.cf) as 1 | 2 | 3), this.renderTicket())));
    side.querySelectorAll<HTMLButtonElement>('[data-sd]').forEach(
      (b) =>
        (b.onclick = () => {
          const sd = b.dataset.sd as Side;
          const ref = s.decisionCandle.c;
          if (sd !== o.side && sd !== 'skip') {
            o.stopPrice = Math.round(ref * (sd === 'long' ? 0.95 : 1.05) * 100) / 100;
            if (this.useTp) o.takeProfit = Math.round(ref * (sd === 'long' ? 1.1 : 0.9) * 100) / 100;
          }
          o.side = sd;
          this.renderTicket();
          this.refresh();
        }),
    );
    const size = side.querySelector<HTMLInputElement>('[data-in=size]');
    if (size) size.oninput = () => ((o.sizeFrac = Number(size.value) / 100), this.renderTicket(), this.refresh());
    const stop = side.querySelector<HTMLInputElement>('[data-in=stop]');
    if (stop) stop.onchange = () => ((o.stopPrice = stop.value === '' ? null : Number(stop.value)), this.renderTicket(), this.refresh());
    const tp = side.querySelector<HTMLInputElement>('[data-in=tp]');
    if (tp) tp.onchange = () => ((o.takeProfit = tp.value === '' ? null : Number(tp.value)), this.renderTicket(), this.refresh());
    const useTp = side.querySelector<HTMLInputElement>('[data-in=useTp]');
    if (useTp)
      useTp.onchange = () => {
        this.useTp = useTp.checked;
        const ref = s.decisionCandle.c;
        o.takeProfit = this.useTp ? Math.round(ref * (o.side === 'long' ? 1.1 : 0.9) * 100) / 100 : null;
        this.renderTicket();
        this.refresh();
      };
    const wick = side.querySelector<HTMLButtonElement>('[data-a=stopWick]');
    if (wick)
      wick.onclick = () => {
        const v = s.visible().slice(-3);
        o.stopPrice = Math.round((o.side === 'long' ? Math.min(...v.map((c) => c.l)) * 0.997 : Math.max(...v.map((c) => c.h)) * 1.003) * 100) / 100;
        this.renderTicket();
        this.refresh();
      };
    const noStop = side.querySelector<HTMLButtonElement>('[data-a=noStop]');
    if (noStop) noStop.onclick = () => ((o.stopPrice = null), this.renderTicket(), this.refresh());
    side.querySelector<HTMLButtonElement>('[data-a=submit]')!.onclick = () => this.submit();
  }

  private submit(): void {
    const errs = this.session.submit({ ...this.order, stopPrice: this.order.side === 'skip' ? null : this.order.stopPrice, takeProfit: this.order.side === 'skip' || !this.useTp ? null : this.order.takeProfit });
    if (errs.length) return;
    this.playing = true;
    this.els.side.innerHTML = `<h3>Odtwarzanie</h3><div class="kv" data-k="live"></div>
      <div class="row"><button data-a="pp">❚❚ Pauza</button><button data-a="st">Krok ▸</button><button data-a="end">Do końca ⏭</button></div>
      <div class="row">${[1, 2, 4].map((v) => `<button data-sp="${v}" class="${this.speed === v ? 'sel' : ''}">${v}×</button>`).join('')}</div>
      <div class="note">Spacja: pauza · →: krok. Decyzja jest zablokowana — tak jak w prawdziwym życiu.</div>`;
    const side = this.els.side;
    this.els.live = side.querySelector('[data-k=live]')!;
    side.querySelector<HTMLButtonElement>('[data-a=pp]')!.onclick = () => ((this.playing = !this.playing), this.renderPlay());
    side.querySelector<HTMLButtonElement>('[data-a=st]')!.onclick = () => this.stepOnce();
    side.querySelector<HTMLButtonElement>('[data-a=end]')!.onclick = () => {
      this.session.runToEnd();
      this.refresh();
      this.showReview();
    };
    side.querySelectorAll<HTMLButtonElement>('[data-sp]').forEach((b) => (b.onclick = () => ((this.speed = Number(b.dataset.sp)), side.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('sel', x === b)))));
    this.renderPlay();
    this.refresh();
  }

  private stepOnce(): void {
    const more = this.session.step();
    this.refresh();
    if (!more || this.session.phase === 'review') this.showReview();
  }

  private renderPlay(): void {
    const pp = this.els.side.querySelector<HTMLButtonElement>('[data-a=pp]');
    if (pp) pp.textContent = this.playing ? '❚❚ Pauza' : '▶ Odtwarzaj';
    const s = this.session;
    this.els.play.textContent = s.phase === 'revealing' ? `świeca ${s.cursor - s.scenario.decisionIndex} / ${s.scenario.horizon}` : s.phase === 'review' ? 'replay zakończony' : 'analiza · przyszłość ukryta';
  }

  private tick(t: number): void {
    if (this.session.phase === 'revealing' && this.playing) {
      if (t - this.playTimer > 650 / this.speed) {
        this.playTimer = t;
        this.stepOnce();
      }
    }
    if (this.session.phase === 'revealing' && this.els.live) {
      const s = this.session;
      const c = s.candles[s.cursor];
      const tr = s.trade;
      const o = s.order!;
      let unreal = 0;
      if (!tr && o.side !== 'skip' && s.cursor > s.scenario.decisionIndex) {
        const entry = s.candles[s.scenario.decisionIndex + 1].o;
        const qty = (s.scenario.capital * o.sizeFrac) / entry;
        unreal = (o.side === 'long' ? 1 : -1) * qty * (c.c - entry);
      }
      this.els.live.innerHTML = `<span>Cena</span><span>${c.c.toFixed(2)}</span><span>Pozycja</span><span>${o.side === 'skip' ? 'brak (POMIŃ)' : tr ? `zamknięta (${tr.exitReason})` : o.side.toUpperCase()}</span><span>Wynik</span><span class="pnl ${(tr ? tr.netPnl : unreal) >= 0 ? 'pos' : 'neg'}">${money(tr ? tr.netPnl : unreal)}</span>`;
    }
  }

  private showReview(): void {
    if (this.els.ov.dataset.shown === '1') return;
    const s = this.session;
    const o = s.order!;
    const ev = evaluate(o, s.preview(o), s.trade);
    const mv = s.afterMove()!;
    const tr = s.trade;
    const cap = s.scenario.capital;
    this.cb.onDecision?.({ side: o.side, sizeFrac: o.sizeFrac, stop: o.stopPrice, tp: o.takeProfit, thesis: o.thesis, confidence: o.confidence, grade: ev.processGrade, score: ev.processScore, netPnl: tr?.netPnl ?? 0, exit: tr?.exitReason ?? 'skip' });
    const crit = ev.criteria.map((c) => `<span class="m ${c.mark}">${{ good: '✓', warn: '!', bad: '✗', info: 'i' }[c.mark]}</span><span><b>${c.label}.</b> ${c.note}</span>`).join('');
    const author = s.scenario.authorNote ? `<div class="dave">${s.scenario.authorNote.map((p) => `<p style="margin:0 0 8px">${p}</p>`).join('')}<div style="text-align:right;font-style:italic">— D.</div></div>` : '';
    this.els.ovBox.innerHTML = `
      <div class="grade"><span class="big">${ev.processGrade}</span><div><h3>Ocena procesu</h3><div>${ev.processScore}/100</div></div>
        <span class="spacer" style="flex:1"></span>
        <div style="text-align:right"><h3>Wynik netto</h3><div class="pnl ${tr && tr.netPnl < 0 ? 'neg' : 'pos'}" style="font-size:20px;font-family:ui-monospace,monospace">${tr ? `${money(tr.netPnl)} (${pct((tr.netPnl / cap) * 100)})` : 'brak pozycji'}</div></div></div>
      <div class="quad">${ev.quadrant}</div>
      <div class="crit">${crit}</div>
      ${tr ? `<div class="kv"><span>Wejście / wyjście</span><span>${tr.entryPrice.toFixed(2)} → ${tr.exitPrice.toFixed(2)} (${{ stop: 'stop', target: 'cel', horizon: 'koniec sesji', gap_stop: 'luka przez stop' }[tr.exitReason]})</span><span>Brutto / opłaty</span><span>${money(tr.grossPnl)} / ${money(tr.fees)}</span><span>Wynik w R</span><span>${tr.rMultiple != null ? tr.rMultiple.toFixed(2) + ' R' : '—'}</span><span>Maks. przeciw / za tobą</span><span>${tr.mae.toFixed(2)}% / ${tr.mfe.toFixed(2)}%</span></div>` : ''}
      <div class="kv"><span>Co zrobił rynek (od decyzji)</span><span>max ${pct(mv.maxUpPct)} · min ${pct(mv.maxDownPct)} · koniec ${pct(mv.endPct)}</span></div>
      ${this.story ? author : ''}
      <div class="row">${this.story && !this.storyDone ? '<button class="primary" data-a="rec">Odtwórz nagranie z archiwum</button>' : ''}<button data-a="train">Sesja treningowa (losowa)</button><button data-a="again">Zamknij terminal</button></div>
      <div class="note">Ocena dotyczy procesu decyzji, nie przewidywania ceny. Dane syntetyczne; to nie jest porada inwestycyjna.</div>`;
    this.els.ov.hidden = false;
    this.els.ov.dataset.shown = '1';
    this.els.live = undefined as unknown as HTMLElement;
    this.els.side.innerHTML = `<h3>Replay zakończony</h3><div class="kv"><span>Decyzja</span><span>${o.side === 'skip' ? 'POMIŃ' : o.side.toUpperCase()}</span><span>Wynik netto</span><span class="pnl ${tr && tr.netPnl < 0 ? 'neg' : 'pos'}">${tr ? money(tr.netPnl) : '$0,00'}</span><span>Ocena procesu</span><span>${ev.processGrade} · ${ev.processScore}/100</span></div><div class="note">Najedź na wykres, żeby obejrzeć świece po decyzji.</div>`;
    const box = this.els.ovBox;
    box.querySelector<HTMLButtonElement>('[data-a=rec]')?.addEventListener('click', () => this.playRecording());
    box.querySelector<HTMLButtonElement>('[data-a=train]')!.onclick = () => {
      this.els.ov.hidden = true;
      this.els.ov.dataset.shown = '0';
      this.open(trainingScenario(1 + Math.floor(Math.random() * 9999)), false);
    };
    box.querySelector<HTMLButtonElement>('[data-a=again]')!.onclick = () => {
      this.els.ov.hidden = true;
      this.els.ov.dataset.shown = '0';
      this.close();
    };
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
    const o = s.phase === 'analysis' ? this.order : s.order!;
    const vis = s.visible();
    const levels: Level[] = [];
    const ref = s.decisionCandle.c;
    if (o.side !== 'skip') {
      if (s.phase === 'analysis') levels.push({ id: 'ref', price: ref, color: '#9fb0c0', label: 'Decyzja (zamknięcie)', draggable: false });
      if (o.stopPrice != null) levels.push({ id: 'stop', price: o.stopPrice, color: '#ff7a78', label: 'STOP', draggable: s.phase === 'analysis' });
      const tp = s.phase === 'analysis' ? (this.useTp ? o.takeProfit : null) : o.takeProfit;
      if (tp != null) levels.push({ id: 'target', price: tp, color: '#4fd1c5', label: 'CEL', draggable: s.phase === 'analysis' });
    }
    const markers: Marker[] = [];
    const first = Math.max(0, s.scenario.decisionIndex - s.scenario.window + 1);
    const tr = s.trade;
    if (s.phase !== 'analysis' && o.side !== 'skip' && s.cursor > s.scenario.decisionIndex) {
      const ei = s.scenario.decisionIndex + 1;
      const entryPrice = tr ? tr.entryPrice : s.candles[ei].o;
      markers.push({ index: ei - first, price: entryPrice, kind: 'entry', color: o.side === 'long' ? '#4fd1c5' : '#ff7a78', label: o.side.toUpperCase() });
      if (tr) markers.push({ index: tr.exitIndex - first, price: tr.exitPrice, kind: 'exit', color: '#ffd29a', label: 'WYJŚCIE' });
    }
    const range = s.priceRange(levels.map((l) => l.price));
    this.chart.set({
      candles: vis,
      slots: s.scenario.window + s.scenario.horizon,
      timeframe: s.scenario.dataset.meta.timeframe,
      priceMin: range.min,
      priceMax: range.max,
      levels,
      markers,
      revealedFrom: s.phase === 'analysis' ? null : s.scenario.decisionIndex + 1 - first,
      decimals: 2,
    });
    this.renderPlay();
  }
}
