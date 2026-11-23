import { sma } from './analysis';
import type { ChartData, Level, Marker, Overlay } from './chart';
import type { ReplaySession } from './session';
import type { OrderInput } from './types';

/**
 * Pure bridge session → chart. Everything drawn comes from session.visible() (never beyond the cursor);
 * indicators are computed on those visible candles only. Tested in tests/replay2.test.ts.
 */
export interface FeedUi {
  draft: OrderInput;
  useTp: boolean;
  ma20: boolean;
  ma50: boolean;
  volume: boolean;
}

export function chartFeed(s: ReplaySession, ui: FeedUi): ChartData {
  const sc = s.scenario;
  const vis = s.visible();
  const first = Math.max(0, sc.decisionIndex - sc.window + 1);
  const decimals = sc.decimals ?? 2;
  const levels: Level[] = [];
  const markers: Marker[] = [];
  const analysis = s.phase === 'analysis';
  const o = analysis ? ui.draft : s.order!;
  if (o.side !== 'skip') {
    if (analysis) {
      levels.push({ id: 'ref', price: s.decisionCandle.c, color: '#9fb0c0', label: 'Decyzja (zamknięcie świecy)', draggable: false });
      if (o.stopPrice != null) levels.push({ id: 'stop', price: o.stopPrice, color: '#ff7a78', label: 'STOP', draggable: true });
      if (ui.useTp && o.takeProfit != null) levels.push({ id: 'target', price: o.takeProfit, color: '#4fd1c5', label: 'CEL', draggable: true });
    } else {
      const pos = s.position();
      if (pos) {
        levels.push({ id: 'entry', price: pos.entryPrice, color: '#d8c49a', label: `WEJŚCIE ${pos.side === 'long' ? 'LONG' : 'SHORT'}`, draggable: false });
        if (pos.stop != null) levels.push({ id: 'stop', price: pos.stop, color: '#ff7a78', label: 'STOP', draggable: s.phase === 'revealing' });
        if (pos.target != null) levels.push({ id: 'target', price: pos.target, color: '#4fd1c5', label: 'CEL', draggable: s.phase === 'revealing' });
      } else if (!s.trade && s.cursor === sc.decisionIndex) {
        if (o.stopPrice != null) levels.push({ id: 'stop', price: o.stopPrice, color: '#ff7a78', label: 'STOP (zlecenie)', draggable: false });
        if (o.takeProfit != null) levels.push({ id: 'target', price: o.takeProfit, color: '#4fd1c5', label: 'CEL (zlecenie)', draggable: false });
      }
      const tr = s.trade;
      if (s.cursor > sc.decisionIndex) {
        const ei = sc.decisionIndex + 1;
        const entry = tr ? tr.entryPrice : (pos?.entryPrice ?? s.candles[ei].o);
        markers.push({ index: ei - first, price: entry, kind: 'entry', color: o.side === 'long' ? '#4fd1c5' : '#ff7a78', label: o.side === 'long' ? 'LONG' : 'SHORT' });
        if (tr) markers.push({ index: tr.exitIndex - first, price: tr.exitPrice, kind: 'exit', color: '#ffd29a', label: 'WYJŚCIE' });
      }
    }
  }
  const overlays: Overlay[] = [];
  if (ui.ma20) overlays.push({ id: 'ma20', label: 'MA20', color: '#e0b25a', values: sma(vis, 20) });
  if (ui.ma50) overlays.push({ id: 'ma50', label: 'MA50', color: '#8a7cf0', values: sma(vis, 50) });
  const m = sc.dataset.meta;
  return {
    candles: vis,
    slots: sc.window + sc.horizon,
    timeframe: m.timeframe,
    levels,
    markers,
    overlays,
    showVolume: ui.volume,
    revealedFrom: analysis ? null : sc.decisionIndex + 1 - first,
    decimals,
    title: `${m.symbol} · ${m.timeframe}`,
  };
}
