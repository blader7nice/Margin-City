import type { Checkpoint, HideSpot, LightZone, Solid } from './types';

/**
 * THE LAST SHIFT — "Hala notowań" (trading hall) prototype fragment.
 * Single source of truth for collision, cover, light, AI routes and camera shots.
 * The visual layer builds its art around these numbers, so gameplay and visuals cannot drift apart.
 *
 * Layout (left → right):
 *  A. Service wing catwalk (spawn, high) → stepped archive cabinets down to the floor.
 *  B. Half-closed security shutter (crouch tutorial).
 *  C. Trading floor: counters (real occlusion cover), MIRROR forecast phone booth, MM-01 patrol.
 *     Upper "third way": crates → mezzanine (dark, quiet if careful, broken gap = landing noise risk).
 *  D. Corridor to the brass vault door of ARCHIVE B-12 (end of prototype).
 */

export const GUARD_LANE_Z = -2.1;
export const LEON_LANE_Z = 0;
export const MEZZ_Y = 4.2;

export const SOLIDS: Solid[] = [
  { id: 'floor', kind: 'floor', x0: -60, x1: 70, y0: -2, y1: 0, occludes: false },
  { id: 'wallL', kind: 'wall', x0: -42, x1: -38, y0: 0, y1: 40 },
  { id: 'wallR', kind: 'wall', x0: 44, x1: 48, y0: 0, y1: 40 },
  // A. Service wing: the catwalk block Leon starts on, stepped archive cabinets.
  { id: 'serviceWing', kind: 'block', x0: -38, x1: -28.5, y0: 0, y1: 6.6 },
  { id: 'cabinetsHigh', kind: 'cabinet', x0: -28.5, x1: -26.4, y0: 0, y1: 4.5 },
  { id: 'cabinetsLow', kind: 'cabinet', x0: -24.6, x1: -22.8, y0: 0, y1: 2.3 },
  { id: 'crateEntrance', kind: 'crate', x0: -20.4, x1: -19.4, y0: 0, y1: 0.95 },
  // B. Security shutter, jammed half-closed: crouch to pass.
  { id: 'shutter', kind: 'shutter', x0: -16.3, x1: -15.9, y0: 1.2, y1: 9 },
  // C. Trading counters: low cover. Crouch on the far side to break line of sight.
  { id: 'counterA', kind: 'counter', x0: -6.4, x1: -4.0, y0: 0, y1: 1.05 },
  { id: 'counterB', kind: 'counter', x0: 3.4, x1: 5.8, y0: 0, y1: 1.05 },
  { id: 'counterC', kind: 'counter', x0: 12.6, x1: 15.0, y0: 0, y1: 1.05 },
  // Upper route: crate stack to the mezzanine.
  { id: 'crateStackLow', kind: 'crate', x0: -2.9, x1: -1.7, y0: 0, y1: 1.0 },
  { id: 'crateStackHigh', kind: 'crate', x0: -1.7, x1: -0.5, y0: 0, y1: 2.2 },
  { id: 'mezzWest', kind: 'mezzanine', x0: 0.2, x1: 8.2, y0: MEZZ_Y - 0.35, y1: MEZZ_Y, oneWay: true },
  { id: 'mezzEast', kind: 'mezzanine', x0: 10.8, x1: 21.0, y0: MEZZ_Y - 0.35, y1: MEZZ_Y, oneWay: true },
  // Mezzanine parapet seen from below: blocks MM-01's view of a crouching Leon (no collision).
  { id: 'parapetWest', kind: 'parapet', x0: 0.2, x1: 8.2, y0: MEZZ_Y, y1: MEZZ_Y + 0.85, noCollide: true },
  { id: 'parapetEast', kind: 'parapet', x0: 10.8, x1: 21.0, y0: MEZZ_Y, y1: MEZZ_Y + 0.85, noCollide: true },
  // Quiet way down at the east end.
  { id: 'crateEastHigh', kind: 'crate', x0: 21.0, x1: 22.2, y0: 0, y1: 2.4 },
  { id: 'crateEastLow', kind: 'crate', x0: 22.2, x1: 23.4, y0: 0, y1: 1.1 },
];

export const HIDE_SPOTS: HideSpot[] = [
  { id: 'booth', x: -9.4, y: 0, reach: 0.8, label: 'budka telefoniczna', forecast: true, depthZ: -0.95 },
  { id: 'nook', x: 9.4, y: 0, reach: 0.8, label: 'wnęka archiwum', forecast: false, depthZ: -0.95 },
  { id: 'lockers', x: 27.5, y: 0, reach: 0.8, label: 'szafka serwisowa', forecast: false, depthZ: -0.95 },
];

/** Lit areas. Light makes Leon visible from further away. Dark mezzanine = the quieter route. */
export const LIGHT_ZONES: LightZone[] = [
  { id: 'pendantBooth', x: -9.4, y: 1.0, radius: 4.6, intensity: 1.0 },
  { id: 'pendantMid', x: -1.6, y: 1.0, radius: 4.2, intensity: 0.85 },
  { id: 'pendantEast', x: 23.6, y: 1.0, radius: 4.2, intensity: 0.9 },
  { id: 'lampA', x: -5.2, y: 1.2, radius: 2.0, intensity: 0.55 },
  { id: 'lampB', x: 4.6, y: 1.2, radius: 2.0, intensity: 0.55 },
  { id: 'lampC', x: 13.8, y: 1.2, radius: 2.0, intensity: 0.55 },
  { id: 'moonShaftWest', x: -20.5, y: 1.0, radius: 3.0, intensity: 0.6 },
  { id: 'moonShaftMezz', x: 15.5, y: MEZZ_Y + 1, radius: 2.2, intensity: 0.65 },
  { id: 'vaultLamp', x: 38.5, y: 1.0, radius: 4.0, intensity: 0.9 },
];
export const AMBIENT_LIGHT = 0.12;

export const CHECKPOINTS: Checkpoint[] = [
  { id: 'start', x: -33, y: 6.6, area: { x0: -38, y0: 0, x1: -28.5, y1: 30 } },
  { id: 'hallEntry', x: -14.2, y: 0, area: { x0: -15.0, y0: 0, x1: -12.0, y1: 3 } },
  { id: 'mezzanine', x: 1.4, y: MEZZ_Y, area: { x0: 0.6, y0: MEZZ_Y - 0.1, x1: 4.0, y1: MEZZ_Y + 3 } },
  { id: 'corridor', x: 25.5, y: 0, area: { x0: 24.5, y0: 0, x1: 30, y1: 3 } },
];

export const SPAWN = { x: -33, y: 6.6 };

/** MM-01 patrol route along the guard aisle behind the counters. */
export const PATROL = [
  { x: -11.5, pause: 2.6 },
  { x: 6.6, pause: 1.4 },
  { x: 22.5, pause: 2.6 },
];
export const GUARD_START = { x: 9.0, facing: -1 as const };
/** Walkable aisle for MM-01 (he does not climb). */
export const GUARD_BOUNDS = { x0: -14.5, x1: 31 };

/** MIRROR forecast: corridor of predicted intrusion and the hotspot MM-01 checks while searching. */
export const FORECAST = {
  corridor: { x0: -13.5, x1: 1.5 },
  hotspotId: 'booth',
  probability: 0.71,
};

export const REVEAL_TRIGGER_X = -14.6;
/** Where MM-01 stands during the reveal (clear sightline for the camera); he then walks away to the right. */
export const REVEAL_GUARD = { x: 2.2, facing: 1 as const, patrolIndex: 1 };
export const VAULT = { x: 39.2, reach: 1.6 };
export const LEVEL_BOUNDS = { x0: -38, x1: 44 };

/** Camera shots: authored framing per region; the director blends between them. */
export interface CameraShot {
  id: string;
  x0: number;
  x1: number;
  /** Camera offset from the focus point. */
  offset: [number, number, number];
  fov: number;
  /** Extra look target offset. */
  look: [number, number, number];
  /** How strongly MM-01 is pulled into frame when he is near (0..1). */
  threatFraming: number;
  minY?: number;
}

export const CAMERA_SHOTS: CameraShot[] = [
  { id: 'entrance', x0: -40, x1: -18, offset: [4.0, 1.4, 14.0], fov: 38, look: [1.8, 1.9, 0], threatFraming: 0 },
  { id: 'shutter', x0: -18, x1: -12, offset: [-4.5, 1.2, 11.0], fov: 36, look: [2.2, 1.7, 0], threatFraming: 0.3 },
  { id: 'floor', x0: -12, x1: 24, offset: [0, 1.35, 15.0], fov: 38, look: [1.5, 2.3, 0], threatFraming: 0.55 },
  { id: 'corridor', x0: 24, x1: 46, offset: [-5.0, 1.1, 11.0], fov: 40, look: [2.5, 1.9, 0], threatFraming: 0.2 },
];
/** Separate framing while Leon is on the mezzanine: higher, looking down at the hall and MM-01. */
export const MEZZ_SHOT: CameraShot = {
  id: 'mezzanine',
  x0: 0,
  x1: 22,
  offset: [0, 2.0, 16.0],
  fov: 38,
  look: [1.5, 0.6, 0],
  threatFraming: 0.45,
};
