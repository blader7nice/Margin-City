/**
 * Market Replay — data contracts. Pure types, no rendering.
 * Designed to be reused by later chapters: any scenario = dataset + decision point + horizon + costs + story text.
 */

/** One OHLCV bar. Time = UNIX seconds, UTC. */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type Timeframe = '15m' | '1h' | '4h' | '1d';

export interface DatasetMeta {
  id: string;
  symbol: string;
  name: string;
  market: string;
  venue: string;
  timeframe: Timeframe;
  timezone: 'UTC';
  currency: string;
  /** Where the numbers come from. For real data: provider + licence reference. */
  source: string;
  /** Synthetic data MUST be labelled as such everywhere it is shown. */
  synthetic: boolean;
  /** Commercial-use status of the data. Real data is only allowed when this is confirmed. */
  license: string;
  note?: string;
}

export interface Dataset {
  meta: DatasetMeta;
  candles: Candle[];
}

export interface CostModel {
  /** Exchange-style fee per side, basis points of notional. */
  feeBps: number;
  /** Adverse slippage per fill, basis points of price. */
  slippageBps: number;
}

export type Side = 'long' | 'short' | 'skip';

/** What the player believes — evaluated against the action (process, not outcome). */
export type ThesisId = 'trend_up' | 'trend_down' | 'capitulation_reversal' | 'breakdown' | 'range' | 'no_edge';

export interface OrderInput {
  side: Side;
  /** Notional as a fraction of capital (0..1). No leverage in the educational replay. */
  sizeFrac: number;
  stopPrice: number | null;
  takeProfit: number | null;
  thesis: ThesisId;
  /** 1 = low, 2 = medium, 3 = high. */
  confidence: 1 | 2 | 3;
}

export type ExitReason = 'stop' | 'target' | 'horizon' | 'gap_stop';

export interface Trade {
  side: 'long' | 'short';
  entryIndex: number;
  entryPrice: number;
  qty: number;
  notional: number;
  stopPrice: number | null;
  takeProfit: number | null;
  exitIndex: number;
  exitPrice: number;
  exitReason: ExitReason;
  grossPnl: number;
  fees: number;
  slippageCost: number;
  netPnl: number;
  /** Net PnL divided by the planned risk (if a stop existed). */
  rMultiple: number | null;
  /** Max adverse / favourable excursion in % of entry, while the trade was open. */
  mae: number;
  mfe: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  /** In-world label; synthetic sessions use a fictional label. */
  dateLabel: string;
  paragraphs: string[];
  signature: string;
}

export interface Scenario {
  id: string;
  title: string;
  dataset: Dataset;
  /** Index of the last candle visible when the decision is made. */
  decisionIndex: number;
  /** Candles revealed after the decision. */
  horizon: number;
  /** How many candles are visible in the analysis window (bible: 40–80). */
  window: number;
  capital: number;
  costs: CostModel;
  journal?: JournalEntry;
  /** Dave's own decision on that session, shown only in the review (never before). */
  authorNote?: string[];
}
