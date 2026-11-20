import { overlaps } from './geom';
import { LEON, type Pushable } from './leon';
import { PUZZLE, SOLIDS } from './level';
import type { AABB, LeonState, SimEvent, Solid } from './types';

/**
 * "The Archivist's Balance" — an original counterweight puzzle for the B-12 corridor.
 *
 * Two brass freight cages hang on one chain over a pulley: when one sinks, the other rises.
 * The brake only releases while someone in the right cage holds the operator lever.
 * Leon alone is too light to lift himself; the ledger cart (heavier than Leon) must ride the left cage.
 *
 *   1. The vault is sealed by MIRROR → look for another way (the broken ledge above it, out of reach).
 *   2. Climb to the cart gallery, push the cart into the left cage (it locks in).
 *   3. Drop down, step into the right cage, pull the lever → cart sinks, Leon rises to the ledge.
 *   4. Emergency hatch panel: clearly warns that opening it will trigger the alarm (chase).
 *
 * Designed to be soft-lock free: the left cage has no lever, so the only way to move the cages is
 * the intended one, and an empty system always rests in the start position (right cage bias).
 */

export interface CartState {
  x: number;
  y: number;
  vy: number;
  locked: boolean;
  grounded: boolean;
}

export interface PuzzleState {
  hL: number;
  hR: number;
  lever: boolean;
  moving: -1 | 0 | 1;
  cart: CartState;
  alarm: boolean;
  hatchOpen: boolean;
  tooLightCount: number;
  solved: boolean;
}

const CART_ID = 'cart';
const GRAVITY = 24;

export function createPuzzle(): PuzzleState {
  return {
    hL: PUZZLE.top,
    hR: 0,
    lever: false,
    moving: 0,
    cart: { x: PUZZLE.cartStart.x, y: PUZZLE.cartStart.y, vy: 0, locked: false, grounded: true },
    alarm: false,
    hatchOpen: false,
    tooLightCount: 0,
    solved: false,
  };
}

export function cartBox(p: PuzzleState): AABB {
  const c = p.cart;
  return { x0: c.x - PUZZLE.cartW / 2, x1: c.x + PUZZLE.cartW / 2, y0: c.y, y1: c.y + PUZZLE.cartH };
}

/** The cart as a solid whose bounds always read the live cart position (it moves mid-step when pushed). */
function liveCartSolid(p: PuzzleState): Solid {
  const hw = PUZZLE.cartW / 2;
  return {
    id: CART_ID,
    kind: 'cart',
    get x0() {
      return p.cart.x - hw;
    },
    get x1() {
      return p.cart.x + hw;
    },
    get y0() {
      return p.cart.y;
    },
    get y1() {
      return p.cart.y + PUZZLE.cartH;
    },
  };
}

/** Moving / state-dependent solids of the puzzle (rebuilt every step). */
export function puzzleSolids(p: PuzzleState): Solid[] {
  const L = PUZZLE.cageL;
  const R = PUZZLE.cageR;
  const out: Solid[] = [
    { id: 'cageLFloor', kind: 'cage', x0: L.x0, x1: L.x1, y0: p.hL - 0.15, y1: p.hL, occludes: false },
    { id: 'cageLBars', kind: 'cage', x0: L.x1 - 0.15, x1: L.x1, y0: p.hL, y1: p.hL + 2.0, occludes: false },
    { id: 'cageRFloor', kind: 'cage', x0: R.x0, x1: R.x1, y0: p.hR - 0.15, y1: p.hR, occludes: false },
    liveCartSolid(p),
  ];
  if (p.cart.locked) out.push({ id: 'cageLGate', kind: 'cage', x0: L.x0, x1: L.x0 + 0.15, y0: p.hL, y1: p.hL + 1.2, occludes: false });
  if (!p.hatchOpen) out.push({ id: 'hatch', kind: 'hatch', ...PUZZLE.hatch });
  return out;
}

function standingOn(l: LeonState, x0: number, x1: number, y: number): boolean {
  return l.grounded && Math.abs(l.y - y) < 0.06 && l.x + LEON.halfW * 0.6 > x0 && l.x - LEON.halfW * 0.6 < x1;
}

export function leonInRightCage(p: PuzzleState, l: LeonState): boolean {
  return standingOn(l, PUZZLE.cageR.x0, PUZZLE.cageR.x1, p.hR);
}
export function leonInLeftCage(p: PuzzleState, l: LeonState): boolean {
  return standingOn(l, PUZZLE.cageL.x0, PUZZLE.cageL.x1, p.hL);
}

export function masses(p: PuzzleState, l: LeonState): { mL: number; mR: number } {
  const mL = (p.cart.locked ? PUZZLE.massCart : 0) + (leonInLeftCage(p, l) ? PUZZLE.massLeon : 0);
  const mR = PUZZLE.biasR + (leonInRightCage(p, l) ? PUZZLE.massLeon : 0);
  return { mL, mR };
}

/** Collision helper for the cart: static solids (incl. cart-only bumpers) + puzzle solids except itself. */
function cartBlockers(p: PuzzleState, extra: Solid[]): Solid[] {
  return [...SOLIDS, ...extra, ...puzzleSolids(p)].filter((s) => s.id !== CART_ID && !s.noCollide);
}

export function makeCartPushable(p: PuzzleState, extraSolids: () => Solid[]): Pushable {
  return {
    box: () => cartBox(p),
    canPush: () => !p.cart.locked && p.cart.grounded,
    push: (dx: number) => {
      const blockers = cartBlockers(p, extraSolids()).filter((s) => !s.oneWay);
      const b = cartBox(p);
      let nx = p.cart.x + dx;
      const nb = { x0: nx - PUZZLE.cartW / 2, x1: nx + PUZZLE.cartW / 2, y0: b.y0 + 0.02, y1: b.y1 };
      for (const s of blockers) {
        if (!overlaps(nb, s, 1e-4)) continue;
        nx = dx > 0 ? s.x0 - PUZZLE.cartW / 2 : s.x1 + PUZZLE.cartW / 2;
      }
      const moved = nx - p.cart.x;
      if (Math.sign(moved) !== Math.sign(dx)) return 0;
      p.cart.x = nx;
      return moved;
    },
  };
}

export interface PuzzleStepContext {
  leon: LeonState;
  interactPressed: boolean;
  events: SimEvent[];
  extraSolids: () => Solid[];
}

/**
 * Step the puzzle mechanics. Moves cages (carrying Leon / the cart), applies cart gravity,
 * handles the lever and the hatch panel. Returns true if the interact press was used.
 */
export function stepPuzzle(p: PuzzleState, dt: number, c: PuzzleStepContext): boolean {
  const l = c.leon;
  let used = false;
  const inR = leonInRightCage(p, l);

  // Lever (only inside the right cage).
  if (c.interactPressed && inR && l.mode === 'normal') {
    used = true;
    p.lever = !p.lever;
    if (p.lever) {
      const { mL, mR } = masses(p, l);
      if (mL > mR + 0.01 && p.hR < PUZZLE.top - 0.01) c.events.push({ type: 'lever', result: 'moving' });
      else {
        p.tooLightCount++;
        c.events.push({ type: 'lever', result: 'tooLight' });
      }
    } else c.events.push({ type: 'lever', result: 'released' });
  }
  if (!inR) p.lever = false;

  // Cages: heavier side sinks while the brake is released.
  const before = { hL: p.hL, hR: p.hR };
  const leonOnL = leonInLeftCage(p, l);
  const leonOnR = inR;
  const cartOnL = p.cart.locked;
  let moving: -1 | 0 | 1 = 0;
  if (p.lever && inR) {
    const { mL, mR } = masses(p, l);
    if (mL > mR + 0.01 && p.hL > 0) moving = -1; // left sinks
    else if (mR > mL + 0.01 && p.hR > 0) moving = 1; // right sinks
  }
  if (moving !== 0) {
    const d = PUZZLE.speed * dt;
    if (moving === -1) p.hL = Math.max(0, p.hL - d);
    else p.hL = Math.min(PUZZLE.top, p.hL + d);
    p.hR = PUZZLE.top - p.hL;
    if (p.hL === 0 || p.hL === PUZZLE.top) {
      c.events.push({ type: 'cageStop', cage: moving === -1 ? 'R' : 'L' });
      if (moving === -1) p.solved = true;
      p.lever = false;
    }
  }
  p.moving = moving;
  // Carry whatever stands on the cages.
  const dL = p.hL - before.hL;
  const dR = p.hR - before.hR;
  if (leonOnR && dR !== 0) l.y = p.hR;
  if (leonOnL && dL !== 0) l.y = p.hL;
  if (cartOnL) {
    p.cart.x = (PUZZLE.cageL.x0 + PUZZLE.cageL.x1) / 2 - 0.12;
    p.cart.y = p.hL;
    p.cart.vy = 0;
    p.cart.grounded = true;
  } else {
    // Cart gravity / landing.
    const blockers = cartBlockers(p, c.extraSolids());
    p.cart.vy = Math.max(p.cart.vy - GRAVITY * dt, -20);
    const prevY = p.cart.y;
    let ny = prevY + p.cart.vy * dt;
    const b = cartBox(p);
    let landed = false;
    for (const s of blockers) {
      const nb = { x0: b.x0 + 0.02, x1: b.x1 - 0.02, y0: ny, y1: ny + PUZZLE.cartH };
      if (!overlaps(nb, s, 1e-4)) continue;
      if (p.cart.vy <= 0 && prevY >= s.y1 - 0.05) {
        ny = s.y1;
        landed = true;
      }
    }
    p.cart.y = ny;
    p.cart.grounded = landed;
    if (landed) p.cart.vy = 0;
    // Lock into the left cage once fully inside.
    const L = PUZZLE.cageL;
    if (landed && Math.abs(p.cart.y - p.hL) < 0.06 && b.x0 > L.x0 + 0.05 && b.x1 <= L.x1 - 0.14) {
      p.cart.locked = true;
      c.events.push({ type: 'cartLocked' });
    }
  }

  // Emergency hatch panel on the broken ledge.
  if (c.interactPressed && !used && !p.alarm && l.mode === 'normal' && l.grounded) {
    if (Math.abs(l.x - PUZZLE.panel.x) <= PUZZLE.panel.reach && Math.abs(l.y - PUZZLE.top) < 0.1) {
      used = true;
      p.alarm = true;
      p.hatchOpen = true;
      c.events.push({ type: 'alarm' });
    }
  }
  return used;
}
