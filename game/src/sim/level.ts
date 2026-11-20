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
 *  D. Corridor: vault door B-12 is sealed by MIRROR → puzzle "The Archivist's Balance" (two counterweighted
 *     brass cages, a ledger cart, a brake lever) → broken service ledge → emergency hatch (triggers the alarm).
 *  E. Archive wing B: two-lane chase (floor + catwalk) against MM-01 and MIRROR route forecasts;
 *     MIRROR seals gates on the predicted lane, MM-01 uses stairs / a service passage to cut Leon off;
 *     the "third way" is a service duct under the floor. Ends at the terminal room door (safe room).
 */

export const GUARD_LANE_Z = -2.1;
export const LEON_LANE_Z = 0;
export const MEZZ_Y = 4.2;
export const LEDGE_Y = 4.4;
export const CATWALK_Y = 4.4;
export const TUNNEL_Y = -1.35;

export const SOLIDS: Solid[] = [
  { id: 'floor', kind: 'floor', x0: -60, x1: 80, y0: -2, y1: 0, occludes: false },
  { id: 'wallL', kind: 'wall', x0: -42, x1: -38, y0: 0, y1: 40 },
  // Corridor end wall with the emergency service hatch opening (y 4.4–6.7, closed by a dynamic hatch).
  { id: 'wallRLow', kind: 'wall', x0: 44, x1: 45, y0: 0, y1: 4.4 },
  { id: 'wallRHigh', kind: 'wall', x0: 44, x1: 45, y0: 6.7, y1: 40 },
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
  // D. Corridor puzzle: crate step → cart gallery (the cart starts here) → cages (dynamic) → broken ledge.
  { id: 'crateCorridor', kind: 'crate', x0: 23.4, x1: 24.5, y0: 0, y1: 2.3 },
  { id: 'gallery', kind: 'mezzanine', x0: 24.6, x1: 29.2, y0: LEDGE_Y - 0.3, y1: LEDGE_Y, oneWay: true },
  { id: 'galleryBumper', kind: 'block', x0: 24.6, x1: 24.75, y0: LEDGE_Y, y1: LEDGE_Y + 0.5, cartOnly: true, occludes: false },
  { id: 'brokenLedge', kind: 'mezzanine', x0: 37.0, x1: 44.0, y0: LEDGE_Y - 0.3, y1: LEDGE_Y, oneWay: true },
  // E. Archive wing B (chase). Catwalk = upper lane, floor = lower lane, duct under the floor = third way.
  { id: 'catwalk1', kind: 'catwalk', x0: 45.0, x1: 55.6, y0: CATWALK_Y - 0.25, y1: CATWALK_Y, oneWay: true, occludes: false },
  { id: 'catwalk2', kind: 'catwalk', x0: 57.4, x1: 71.0, y0: CATWALK_Y - 0.25, y1: CATWALK_Y, oneWay: true, occludes: false },
  { id: 'catwalk3', kind: 'catwalk', x0: 73.6, x1: 83.0, y0: CATWALK_Y - 0.25, y1: CATWALK_Y, oneWay: true, occludes: false },
  { id: 'catwalk4', kind: 'catwalk', x0: 84.6, x1: 88.0, y0: CATWALK_Y - 0.25, y1: CATWALK_Y, oneWay: true, occludes: false },
  { id: 'crateArchive', kind: 'crate', x0: 50.6, x1: 51.6, y0: 0, y1: 1.0 },
  { id: 'stack1', kind: 'stack', x0: 55.4, x1: 56.8, y0: 0, y1: 2.2 },
  { id: 'stack2', kind: 'stack', x0: 81.6, x1: 83.0, y0: 0, y1: 2.2 },
  { id: 'grateIn', kind: 'grate', x0: 80.0, x1: 81.2, y0: -0.12, y1: 0, oneWay: true, occludes: false },
  { id: 'ductRoof', kind: 'floor', x0: 81.2, x1: 95.0, y0: -0.2, y1: 0 },
  { id: 'grateOut', kind: 'grate', x0: 95.0, x1: 96.2, y0: -0.12, y1: 0, oneWay: true, occludes: false },
  { id: 'floorEnd', kind: 'floor', x0: 96.2, x1: 130, y0: -2, y1: 0, occludes: false },
  { id: 'ductBed', kind: 'floor', x0: 79.0, x1: 98.0, y0: -3, y1: TUNNEL_Y, occludes: false },
  { id: 'wallFar', kind: 'wall', x0: 100, x1: 104, y0: 0, y1: 40 },
];

export const HIDE_SPOTS: HideSpot[] = [
  { id: 'booth', x: -9.4, y: 0, reach: 0.8, label: 'budka telefoniczna', forecast: true, depthZ: -0.95 },
  { id: 'nook', x: 9.4, y: 0, reach: 0.8, label: 'wnęka archiwum', forecast: false, depthZ: -0.95 },
  { id: 'lockers', x: 27.5, y: 0, reach: 0.8, label: 'szafka serwisowa', forecast: false, depthZ: -0.95 },
];

/** Lit areas. Light makes Leon visible from further away. Dark mezzanine = the quieter route. */
export const LIGHT_ZONES: LightZone[] = [
  { id: 'cageLamp', x: 33.1, y: 3.0, radius: 3.6, intensity: 0.7 },
  { id: 'archiveLampA', x: 52, y: 1.0, radius: 5, intensity: 0.8 },
  { id: 'archiveLampB', x: 76, y: 1.0, radius: 5, intensity: 0.8 },
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
  { id: 'ledge', x: 38.6, y: LEDGE_Y, area: { x0: 37.5, y0: LEDGE_Y - 0.1, x1: 42, y1: LEDGE_Y + 3 } },
  // Chase checkpoints are activated by the chase itself (alarm) or by passing the drift.
  { id: 'chaseStart', x: 46.2, y: CATWALK_Y, area: { x0: 0, y0: 0, x1: 0, y1: 0 } },
  { id: 'chaseMid', x: 74.6, y: CATWALK_Y, area: { x0: 73.6, y0: -0.5, x1: 79, y1: 8 } },
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

/** "The Archivist's Balance": two cages on one chain over a pulley. Heavier side sinks (only with the brake released). */
export const PUZZLE = {
  top: LEDGE_Y,
  cageL: { x0: 29.2, x1: 31.0 },
  cageR: { x0: 35.2, x1: 37.0 },
  pulleyX: 33.1,
  pulleyY: 6.6,
  speed: 1.05,
  massLeon: 1,
  massCart: 2,
  /** The right cage is slightly heavier when empty: the mechanism rests in its start position. */
  biasR: 0.4,
  cartStart: { x: 27.0, y: LEDGE_Y },
  cartW: 1.0,
  cartH: 0.95,
  pushSpeed: 1.6,
  panel: { x: 43.1, reach: 0.9 },
  hatch: { x0: 44, x1: 45, y0: LEDGE_Y, y1: 6.7 },
};

/** Archive wing chase tuning. */
export const CHASE = {
  mmEntryX: 47.2,
  mmEnterDelay: 2.4,
  speed: 4.4,
  stairs: [59.2, 85.4],
  stairTime: 1.6,
  gateDecisionX: 52,
  interceptDecisionX: 75,
  gates: [
    { id: 'G1', lane: 'catwalk' as const, x0: 63.0, x1: 63.4, closed: CATWALK_Y, open: 7.8, top: 7.9, closeTime: 0.6 },
    { id: 'G2', lane: 'floor' as const, x0: 67.0, x1: 67.4, closed: 0, open: 3.6, top: 3.7, closeTime: 0.9 },
  ],
  warnTime: 1.2,
  closedTime: 6,
  openTime: 0.8,
  passageDoorX: 87.6,
  /** MM-01 only steps out of the passage if Leon is at least this far away (no unfair point-blank grabs). */
  passageMinGap: 3.0,
  passageDelay: 1.7,
  /** Beat in the doorway before MM-01 moves (telegraph). */
  stepOutTime: 0.9,
  landingWaitX: 88.6,
  waitMax: 5,
  drift: { x0: 74, x1: 79, leonMul: 0.5, mmMul: 0.6 },
  doorX0: 92.0,
  doorX1: 92.3,
  roomEnterX: 92.8,
  respawnBehind: 13,
  bounds: { x0: 45.4, x1: 99.4 },
};
export const LEVEL_BOUNDS = { x0: -38, x1: 100 };
/** Terminal B-12 desk in the safe room (Market Replay). */
export const TERMINAL = { x: 97.4, reach: 1.1 };

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
  /** Optional room framing: pull the focus toward this x. */
  lockX?: number;
  lockWeight?: number;
}

export const CAMERA_SHOTS: CameraShot[] = [
  { id: 'entrance', x0: -40, x1: -18, offset: [4.0, 1.4, 14.0], fov: 38, look: [1.8, 1.9, 0], threatFraming: 0 },
  { id: 'shutter', x0: -18, x1: -12, offset: [-4.5, 1.2, 11.0], fov: 36, look: [2.2, 1.7, 0], threatFraming: 0.3 },
  { id: 'floor', x0: -12, x1: 24, offset: [0, 1.35, 15.0], fov: 38, look: [1.5, 2.3, 0], threatFraming: 0.55 },
  // Puzzle room: frame the whole mechanism (focus pulled toward the room centre), like a diorama.
  { id: 'corridor', x0: 24, x1: 44.6, offset: [0, 2.4, 16.5], fov: 42, look: [0, 2.6, 0], threatFraming: 0.2, lockX: 34.2, lockWeight: 0.65 },
  // Archive wing chase: both lanes in frame, strong lead in the running direction.
  { id: 'archive', x0: 44.6, x1: 92.4, offset: [0, 2.4, 15.0], fov: 42, look: [3.2, 2.2, 0], threatFraming: 0.6 },
  { id: 'terminal', x0: 92.4, x1: 130, offset: [-3.5, 1.6, 11.5], fov: 38, look: [1.5, 1.6, 0], threatFraming: 0.4 },
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
