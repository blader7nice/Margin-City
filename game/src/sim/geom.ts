import type { AABB } from './types';

export function overlaps(a: AABB, b: AABB, eps = 0): boolean {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.y0 < b.y1 - eps && a.y1 > b.y0 + eps;
}

/**
 * Segment vs AABB (slab test). Returns true if the open segment passes through the box interior.
 * Touching an edge does not count, so a target standing exactly on a counter is not hidden by it.
 */
export function segmentHitsBox(ax: number, ay: number, bx: number, by: number, box: AABB, eps = 1e-4): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const x0 = box.x0 + eps;
  const x1 = box.x1 - eps;
  const y0 = box.y0 + eps;
  const y1 = box.y1 - eps;
  if (Math.abs(dx) < 1e-9) {
    if (ax <= x0 || ax >= x1) return false;
  } else {
    let t0 = (x0 - ax) / dx;
    let t1 = (x1 - ax) / dx;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin >= tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (ay <= y0 || ay >= y1) return false;
  } else {
    let t0 = (y0 - ay) / dy;
    let t1 = (y1 - ay) / dy;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin >= tmax) return false;
  }
  return tmax > 0 && tmin < 1;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return Math.min(v + maxDelta, target);
  return Math.max(v - maxDelta, target);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
