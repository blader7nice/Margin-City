// Pure simulation types. No three.js imports here: the simulation must run headless in tests.
// Coordinates: metres. x = gameplay axis (left/right), y = up. Depth (z) only matters for rendering.

export interface AABB {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type SolidKind =
  | 'floor'
  | 'wall'
  | 'block'
  | 'cabinet'
  | 'crate'
  | 'counter'
  | 'shutter'
  | 'mezzanine'
  | 'parapet';

export interface Solid extends AABB {
  id: string;
  kind: SolidKind;
  /** Can be jumped through from below and stood on from above. */
  oneWay?: boolean;
  /** Blocks MM-01 line of sight (default true). */
  occludes?: boolean;
  /** Has no physical collision (pure sight blocker, e.g. a parapet seen in projection). */
  noCollide?: boolean;
}

export interface HideSpot {
  id: string;
  x: number;
  y: number;
  /** Half-width of the area where [E] works. */
  reach: number;
  label: string;
  /** MIRROR forecast marks this spot as a likely intruder hiding place. Visible to the player. */
  forecast: boolean;
  /** Depth Leon steps into when hiding (render only). */
  depthZ: number;
}

export interface LightZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
}

export interface Checkpoint {
  id: string;
  x: number;
  y: number;
  /** Activated when Leon is inside this region. */
  area: AABB;
}

export interface InputState {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  run: boolean;
  crouch: boolean;
  interact: boolean;
}

export const NO_INPUT: InputState = {
  left: false,
  right: false,
  down: false,
  jump: false,
  run: false,
  crouch: false,
  interact: false,
};

export type LeonMode =
  | 'normal'
  | 'mantle'
  | 'enterHide'
  | 'hidden'
  | 'exitHide'
  | 'caught'
  | 'cutscene'
  | 'finished';

export interface LeonState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  crouching: boolean;
  running: boolean;
  height: number;
  mode: LeonMode;
  modeT: number;
  hideId: string | null;
  coyote: number;
  jumpBuffer: number;
  stepTimer: number;
  mantleFrom: { x: number; y: number };
  mantleTo: { x: number; y: number };
  /** Peak downward speed of the last landing (for animation/noise). */
  lastLandingSpeed: number;
  airTime: number;
  /** 0..1 light level at Leon's body, derived from level light zones. */
  light: number;
  /** 0..1 how exposed Leon currently is to MM-01 (for UI/debug only). */
  exposure: number;
}

export type GuardMode = 'patrol' | 'suspicious' | 'chase' | 'search' | 'return';

export interface SightSample {
  x: number;
  y: number;
  inCone: boolean;
  blocked: boolean;
}

export interface GuardState {
  x: number;
  y: number;
  facing: 1 | -1;
  /** Head yaw offset used while looking around (render + cone direction). */
  lookDir: 1 | -1;
  mode: GuardMode;
  modeT: number;
  suspicion: number;
  lastKnown: { x: number; y: number } | null;
  patrolIndex: number;
  pauseT: number;
  searchPhase: 'goto' | 'look' | 'forecast' | 'inspect';
  forecastChecked: boolean;
  /** Leon was seen entering this hide spot. */
  sawHideId: string | null;
  speed: number;
  /** Debug data from the last perception tick. */
  sight: { visible: boolean; range: number; samples: SightSample[] };
  heardAt: { x: number; y: number; t: number } | null;
}

export type SimEvent =
  | { type: 'step'; who: 'leon' | 'guard'; x: number; run: boolean }
  | { type: 'jump' }
  | { type: 'land'; speed: number }
  | { type: 'mantle' }
  | { type: 'noise'; x: number; y: number; radius: number; source: string }
  | { type: 'guardMode'; from: GuardMode; to: GuardMode }
  | { type: 'heard'; x: number; y: number }
  | { type: 'caught'; reason: 'grabbed' | 'found' }
  | { type: 'respawn'; checkpoint: string }
  | { type: 'checkpoint'; id: string }
  | { type: 'hide'; id: string }
  | { type: 'unhide'; id: string }
  | { type: 'reveal' }
  | { type: 'finished' };

export interface NoiseEvent {
  x: number;
  y: number;
  radius: number;
  source: string;
}
