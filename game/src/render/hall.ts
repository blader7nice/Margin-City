import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Assets } from './assets';
import { clockFace, corrugated, hazardStripes, radialSprite, signTexture, tickerBoard } from './canvasTex';
import { FORECAST, HIDE_SPOTS, LIGHT_ZONES, MEZZ_Y, SOLIDS, VAULT } from '../sim/level';
import type { Solid } from '../sim/types';
import type { Quality } from './quality';
import type { LightPool } from './lightPool';

/**
 * The visual layer of "The Last Shift" trading hall.
 * Everything is built procedurally around the gameplay numbers in sim/level.ts.
 * Art direction: monumental Art Deco at night — warm amber memory-light vs cold MIRROR cyan,
 * a tiny Leon against 30 m columns, layered foreground / gameplay / background depth.
 */

const BACK_WALL_Z = -24;
const BACK_COLS_Z = -14;
const HALL_X0 = -60;
const HALL_X1 = 70;
const WINDOW_SILL = 6.5;
const WINDOW_SPRING = 21; // where the arch starts
const WINDOW_HALF_W = 2.3;
const MOON_DIR = new THREE.Vector3(0.18, -0.86, 0.48).normalize(); // light travels down and toward camera

export interface HallRefs {
  root: THREE.Group;
  update: (t: number, dt: number, ctx: HallFrameContext) => void;
  moon: THREE.DirectionalLight;
  shadowCasters: THREE.Object3D[];
  boothDoor: THREE.Object3D;
  nookDoor: THREE.Object3D;
  lockerDoor: THREE.Object3D;
  envScene: THREE.Scene;
  /** Large objects that may stand between camera and Leon (faded by the occlusion system). */
  occluders: THREE.Object3D[];
}

export interface HallFrameContext {
  leonX: number;
  leonY: number;
  camX: number;
  camZ: number;
  guardMode: string;
  hiddenIn: string | null;
}

export interface Mats {
  marble: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  bronzeDark: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  cabinet: THREE.MeshStandardMaterial;
  kraft: THREE.MeshStandardMaterial;
  frieze: THREE.MeshStandardMaterial;
  silhouette: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  velvet: THREE.MeshStandardMaterial;
  paperWhite: THREE.MeshStandardMaterial;
  greenGlass: THREE.MeshStandardMaterial;
  amberGlow: THREE.MeshBasicMaterial;
  cyanGlow: THREE.MeshBasicMaterial;
  black: THREE.MeshStandardMaterial;
}

export function makeMats(a: Assets): Mats {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const marble = std({
    map: a.get('marble_albedo', (HALL_X1 - HALL_X0) / 4, 40 / 4),
    roughnessMap: a.get('marble_orm', (HALL_X1 - HALL_X0) / 4, 40 / 4),
    metalnessMap: a.get('marble_orm', (HALL_X1 - HALL_X0) / 4, 40 / 4),
    normalMap: a.get('marble_normal', (HALL_X1 - HALL_X0) / 4, 40 / 4),
    roughness: 0.85,
    metalness: 1,
    color: 0x8a8178,
    envMapIntensity: 1.6,
  });
  const stone = std({
    map: a.get('stone_albedo'),
    roughnessMap: a.get('stone_orm'),
    normalMap: a.get('stone_normal'),
    roughness: 1,
    metalness: 0,
    color: 0xd8cfc2,
  });
  const stoneDark = stone.clone();
  stoneDark.color = new THREE.Color(0x8d8478);
  const wood = std({
    map: a.get('wood_albedo'),
    roughnessMap: a.get('wood_orm'),
    normalMap: a.get('wood_normal'),
    roughness: 1,
    envMapIntensity: 0.7,
  });
  const frieze = std({
    map: a.get('frieze_albedo'),
    roughnessMap: a.get('frieze_orm'),
    metalnessMap: a.get('frieze_orm'),
    normalMap: a.get('frieze_normal'),
    roughness: 1,
    metalness: 1,
  });
  return {
    marble,
    stone,
    stoneDark,
    wood,
    frieze,
    brass: std({ color: 0xc9944a, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 }),
    bronzeDark: std({ color: 0x5a4127, metalness: 0.9, roughness: 0.45 }),
    steel: std({ color: 0x59626c, metalness: 0.8, roughness: 0.42, map: corrugated() }),
    cabinet: std({ color: 0x3d4a47, metalness: 0.55, roughness: 0.48 }),
    kraft: std({ color: 0x8a6a46, roughness: 0.92, normalMap: a.get('wood_normal') }),
    silhouette: std({ color: 0x0b0d12, roughness: 0.9, transparent: true, opacity: 1 }),
    glass: std({ color: 0xc8b48a, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    velvet: std({ color: 0x5a1a20, roughness: 0.85 }),
    paperWhite: std({ color: 0xe6dfcf, roughness: 0.95 }),
    greenGlass: std({ color: 0x1f6b44, emissive: 0x2fbf6f, emissiveIntensity: 0.9, roughness: 0.3 }),
    amberGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(3.2) }),
    cyanGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ff2ff).multiplyScalar(2.2), transparent: true }),
    black: std({ color: 0x050505, roughness: 1 }),
  };
}

function setUV2(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g;
}

export function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true, receive = true): THREE.Mesh {
  const me = new THREE.Mesh(g, m);
  me.position.set(x, y, z);
  me.castShadow = cast;
  me.receiveShadow = receive;
  return me;
}

/** Box with UVs scaled to world metres (so tiling textures keep a constant texel density). */
export function worldBox(w: number, h: number, d: number, scale = 1): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const px = pos.getX(i) + w / 2;
    const py = pos.getY(i) + h / 2;
    const pz = pos.getZ(i) + d / 2;
    let u: number;
    let v: number;
    if (nx > 0.5) {
      u = pz;
      v = py;
    } else if (ny > 0.5) {
      u = px;
      v = pz;
    } else {
      u = px;
      v = py;
    }
    uv.setXY(i, (u / 4) * scale, (v / 4) * scale);
  }
  return g;
}

/** Fluted Deco column shaft. */
export function flutedColumn(radius: number, height: number, flutes = 20, radial = 80): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius * 1.04, height, radial, 1, true);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const k = 1 - 0.045 * Math.pow(Math.max(0, Math.cos(a * flutes)), 2);
    pos.setX(i, (x / r) * r * k);
    pos.setZ(i, (z / r) * r * k);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * (height / 4));
  return g;
}

function decoCapital(radius: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  const tiers = [
    [radius * 1.12, 0.35],
    [radius * 1.28, 0.3],
    [radius * 1.5, 0.45],
    [radius * 1.75, 0.6],
  ];
  for (const [w, h] of tiers) {
    const b = new THREE.BoxGeometry(w * 2, h, w * 2);
    b.translate(0, y + h / 2, 0);
    parts.push(b);
    y += h;
  }
  return mergeGeometries(parts)!;
}

function decoBase(radius: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers = [
    [radius * 1.7, 0.5],
    [radius * 1.45, 0.35],
    [radius * 1.2, 0.25],
  ];
  let y = 0;
  for (const [w, h] of tiers) {
    const b = new THREE.BoxGeometry(w * 2, h, w * 2);
    b.translate(0, y + h / 2, 0);
    parts.push(b);
    y += h;
  }
  return mergeGeometries(parts)!;
}

function solidById(id: string): Solid {
  const s = SOLIDS.find((x) => x.id === id);
  if (!s) throw new Error(`solid ${id}`);
  return s;
}

export function buildHall(a: Assets, q: Quality, lights: LightPool): HallRefs {
  const root = new THREE.Group();
  root.name = 'hall';
  const M = makeMats(a);
  const casters: THREE.Object3D[] = [];
  const occluders: THREE.Object3D[] = [];
  const updaters: ((t: number, dt: number, ctx: HallFrameContext) => void)[] = [];
  const add = (o: THREE.Object3D, cast = false) => {
    root.add(o);
    if (cast) casters.push(o);
    return o;
  };

  // ---------- Floor ----------
  // Marble floor of the hall + corridor (the archive wing beyond x=45 has its own floor).
  const FLOOR_X1 = 45;
  const floorGeo = new THREE.PlaneGeometry(FLOOR_X1 - HALL_X0, 40);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
    const k = (FLOOR_X1 - HALL_X0) / (HALL_X1 - HALL_X0);
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  }
  const floor = mesh(floorGeo, M.marble, (HALL_X0 + FLOOR_X1) / 2, 0, -8, false, true);
  add(floor);

  // ---------- Back wall with arched windows ----------
  const wallShape = new THREE.Shape();
  wallShape.moveTo(HALL_X0, 0);
  wallShape.lineTo(HALL_X1, 0);
  wallShape.lineTo(HALL_X1, 38);
  wallShape.lineTo(HALL_X0, 38);
  wallShape.closePath();
  const windowXs: number[] = [];
  const clockX = 4.5;
  for (let x = -31.5; x <= 62; x += 9) windowXs.push(x);
  for (const wx of windowXs) {
    const hole = new THREE.Path();
    if (Math.abs(wx - clockX) < 0.1) {
      hole.absarc(wx, 15.5, 5.2, 0, Math.PI * 2, false);
    } else {
      hole.moveTo(wx - WINDOW_HALF_W, WINDOW_SILL);
      hole.lineTo(wx + WINDOW_HALF_W, WINDOW_SILL);
      hole.lineTo(wx + WINDOW_HALF_W, WINDOW_SPRING);
      hole.absarc(wx, WINDOW_SPRING, WINDOW_HALF_W, 0, Math.PI, false);
      hole.lineTo(wx - WINDOW_HALF_W, WINDOW_SILL);
    }
    wallShape.holes.push(hole);
  }
  const wallGeo = new THREE.ShapeGeometry(wallShape, 24);
  {
    const uv = wallGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  }
  add(mesh(wallGeo, M.stoneDark, 0, 0, BACK_WALL_Z, false, true));

  // Window reveals, mullions, sky beyond.
  const mullionMat = M.bronzeDark;
  const winGroup = new THREE.Group();
  for (const wx of windowXs) {
    if (Math.abs(wx - clockX) < 0.1) continue;
    // reveal (depth) sides
    const sideGeo = worldBox(0.5, WINDOW_SPRING - WINDOW_SILL, 1.6);
    winGroup.add(mesh(sideGeo, M.stone, wx - WINDOW_HALF_W - 0.25, (WINDOW_SILL + WINDOW_SPRING) / 2, BACK_WALL_Z - 0.8, false, false));
    winGroup.add(mesh(sideGeo, M.stone, wx + WINDOW_HALF_W + 0.25, (WINDOW_SILL + WINDOW_SPRING) / 2, BACK_WALL_Z - 0.8, false, false));
    winGroup.add(mesh(worldBox(WINDOW_HALF_W * 2 + 1, 0.5, 1.8), M.stone, wx, WINDOW_SILL - 0.25, BACK_WALL_Z - 0.6, false, false));
    // Deco mullions: verticals + horizontals + stepped arch bars
    for (const dx of [-WINDOW_HALF_W * 0.5, 0, WINDOW_HALF_W * 0.5]) {
      winGroup.add(mesh(new THREE.BoxGeometry(0.09, WINDOW_SPRING - WINDOW_SILL + 1.6, 0.12), mullionMat, wx + dx, (WINDOW_SILL + WINDOW_SPRING + 1.6) / 2, BACK_WALL_Z - 0.9, false, false));
    }
    for (let y = WINDOW_SILL + 2.2; y < WINDOW_SPRING; y += 2.6) {
      winGroup.add(mesh(new THREE.BoxGeometry(WINDOW_HALF_W * 2, 0.07, 0.1), mullionMat, wx, y, BACK_WALL_Z - 0.9, false, false));
    }
    const arc = new THREE.TorusGeometry(WINDOW_HALF_W * 0.62, 0.05, 6, 24, Math.PI);
    winGroup.add(mesh(arc, mullionMat, wx, WINDOW_SPRING, BACK_WALL_Z - 0.9, false, false));
  }
  add(winGroup);

  // Clock rose window: backlit glass face, 23:58.
  const clockMat = new THREE.MeshBasicMaterial({ map: clockFace(), color: new THREE.Color(1.15, 1.0, 0.85) });
  const clock = mesh(new THREE.CircleGeometry(5.2, 64), clockMat, clockX, 15.5, BACK_WALL_Z - 0.7, false, false);
  add(clock);
  add(mesh(new THREE.TorusGeometry(5.3, 0.32, 10, 72), M.brass, clockX, 15.5, BACK_WALL_Z + 0.05, false, false));
  add(mesh(new THREE.TorusGeometry(5.9, 0.18, 8, 72), M.bronzeDark, clockX, 15.5, BACK_WALL_Z + 0.08, false, false));

  // City beyond: skyline + rain + moon haze.
  const sky = new THREE.MeshBasicMaterial({ map: a.get('skyline', 3, 1), color: new THREE.Color(0.9, 0.95, 1.1) });
  add(mesh(new THREE.PlaneGeometry(HALL_X1 - HALL_X0, 30), sky, (HALL_X0 + HALL_X1) / 2, 14, BACK_WALL_Z - 10, false, false));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNoise: { value: a.get('noise') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
      void main(){
        vec2 uv = vec2(vUv.x*60.0, vUv.y*3.0 + uTime*2.2);
        float n = texture2D(uNoise, vec2(uv.x*0.05, uv.y*0.15)).r;
        float streak = smoothstep(0.82, 1.0, n) * smoothstep(0.0, 0.3, vUv.y);
        float haze = 0.06 * smoothstep(0.0, 0.9, vUv.y);
        gl_FragColor = vec4(vec3(0.55,0.65,0.8) * (streak*0.35 + haze), 1.0);
      }`,
  });
  const rain = mesh(new THREE.PlaneGeometry(HALL_X1 - HALL_X0, 26), rainMat, (HALL_X0 + HALL_X1) / 2, 14, BACK_WALL_Z - 3, false, false);
  add(rain);
  updaters.push((t) => {
    rainMat.uniforms.uTime.value = t;
  });

  // Wood dado + brass trim, frieze band, cornice.
  add(mesh(worldBox(HALL_X1 - HALL_X0, 3.2, 0.3), M.wood, (HALL_X0 + HALL_X1) / 2, 1.6, BACK_WALL_Z + 0.15, false, true));
  add(mesh(new THREE.BoxGeometry(HALL_X1 - HALL_X0, 0.08, 0.36), M.brass, (HALL_X0 + HALL_X1) / 2, 3.24, BACK_WALL_Z + 0.18, false, false));
  const friezeGeo = new THREE.PlaneGeometry(HALL_X1 - HALL_X0, 1.6);
  {
    const uv = friezeGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ((HALL_X1 - HALL_X0) / 4));
  }
  add(mesh(friezeGeo, M.frieze, (HALL_X0 + HALL_X1) / 2, 26.2, BACK_WALL_Z + 0.05, false, false));
  add(mesh(worldBox(HALL_X1 - HALL_X0, 0.8, 1.6), M.stone, (HALL_X0 + HALL_X1) / 2, 27.6, BACK_WALL_Z + 0.8, false, false));

  // ---------- Back colonnade ----------
  const colR = 1.15;
  const colH = 26.5;
  const shaft = flutedColumn(colR, colH);
  const cap = decoCapital(colR);
  const base = decoBase(colR);
  for (let x = -36; x <= 64; x += 9) {
    const g = new THREE.Group();
    g.add(mesh(base, M.stone, 0, 0, 0, true, true));
    g.add(mesh(shaft, M.stone, 0, 1.1 + colH / 2, 0, true, true));
    g.add(mesh(cap, M.stone, 0, 1.1 + colH, 0, true, true));
    g.add(mesh(new THREE.TorusGeometry(colR * 1.02, 0.07, 6, 40).rotateX(Math.PI / 2), M.brass, 0, 1.25, 0, false, false));
    g.add(mesh(new THREE.TorusGeometry(colR * 1.02, 0.07, 6, 40).rotateX(Math.PI / 2), M.brass, 0, 1.1 + colH - 0.2, 0, false, false));
    g.position.set(x, 0, BACK_COLS_Z);
    add(g, true);
  }
  // Entablature over the colonnade.
  add(mesh(worldBox(HALL_X1 - HALL_X0, 1.6, 3.2), M.stone, (HALL_X0 + HALL_X1) / 2, 1.1 + colH + 1.7 + 0.8, BACK_COLS_Z, false, true));

  // ---------- Ticker board (hung over the floor) ----------
  const ticker = tickerBoard();
  const tickerMat = new THREE.MeshBasicMaterial({ map: ticker.texture, color: new THREE.Color(1.6, 1.4, 1.2) });
  const tickerW = 36;
  const tGroup = new THREE.Group();
  tGroup.add(mesh(new THREE.PlaneGeometry(tickerW, 3.4), tickerMat, 0, 0, 0.13, false, false));
  tGroup.add(mesh(new THREE.BoxGeometry(tickerW + 0.8, 4.1, 0.25), M.bronzeDark, 0, 0, 0, true, false));
  tGroup.add(mesh(new THREE.BoxGeometry(tickerW + 1.0, 0.18, 0.4), M.brass, 0, 2.1, 0.05, false, false));
  tGroup.add(mesh(new THREE.BoxGeometry(tickerW + 1.0, 0.18, 0.4), M.brass, 0, -2.1, 0.05, false, false));
  for (const cx of [-tickerW / 2 + 1, -6, 6, tickerW / 2 - 1]) {
    tGroup.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 16, 4), M.bronzeDark, cx, 10, 0, false, false));
  }
  tGroup.position.set(5, 13.2, -9.5);
  add(tGroup);
  updaters.push((t) => ticker.update(t));

  // ---------- Service wing (spawn) ----------
  {
    const s = solidById('serviceWing');
    const w = s.x1 - s.x0;
    add(mesh(worldBox(w, s.y1, 4.6), M.stone, (s.x0 + s.x1) / 2, s.y1 / 2, -1.1, true, true), true);
    add(mesh(worldBox(w, 0.12, 4.7, 2), M.wood, (s.x0 + s.x1) / 2, s.y1 + 0.06, -1.1, false, true));
    // Railing behind Leon + cold light from the open service door he came through.
    add(mesh(new THREE.BoxGeometry(w, 0.06, 0.06), M.brass, (s.x0 + s.x1) / 2, s.y1 + 1.0, -3.0, false, false));
    for (let x = s.x0 + 0.3; x < s.x1; x += 0.5) add(mesh(new THREE.BoxGeometry(0.03, 1.0, 0.03), M.bronzeDark, x, s.y1 + 0.5, -3.0, false, false));
    const doorGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.62, 0.9).multiplyScalar(0.85) });
    add(mesh(new THREE.PlaneGeometry(1.6, 2.6), doorGlow, -35.5, s.y1 + 1.3, -3.35, false, false));
    add(mesh(worldBox(2.3, 3.1, 0.4), M.stoneDark, -35.5, s.y1 + 1.55, -3.6, false, false));
    // Small doorway structure (no full wall: the monumental hall must open up behind Leon).
    add(mesh(worldBox(4.2, 4.4, 1.0), M.stoneDark, -35.5, s.y1 + 2.2, -4.0, false, true));
    add(mesh(new THREE.BoxGeometry(2.6, 0.12, 1.1), M.brass, -35.5, s.y1 + 3.0, -3.45, false, false));
    lights.add({ position: [-35.5, s.y1 + 1.6, -2.4], color: 0x8fb4ff, intensity: 7, distance: 9, decay: 2 });
  }

  // ---------- Archive cabinets (stepped descent) ----------
  const cabUnitGeo = new RoundedBoxGeometry(0.52, 1.28, 0.62, 2, 0.03);
  const drawerLine = new THREE.BoxGeometry(0.46, 0.012, 0.01);
  const handle = new THREE.BoxGeometry(0.12, 0.025, 0.03);
  const buildCabinets = (s: Solid, z: number, depthRows = 1) => {
    const g = new THREE.Group();
    const cols = Math.max(1, Math.round((s.x1 - s.x0) / 0.53));
    const rows = Math.max(1, Math.round((s.y1 - s.y0) / 1.29));
    const sx = (s.x1 - s.x0) / cols;
    const sy = (s.y1 - s.y0) / rows;
    for (let d = 0; d < depthRows; d++)
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          const u = mesh(cabUnitGeo, M.cabinet, s.x0 + sx * (c + 0.5), s.y0 + sy * (r + 0.5), z - d * 0.64, true, true);
          u.scale.set(sx / 0.53, sy / 1.29, 1);
          u.rotation.y = (Math.sin(c * 7.1 + r * 3.3) * 0.03);
          g.add(u);
          for (let k = 0; k < 4; k++) {
            const yy = s.y0 + sy * r + (sy / 4) * (k + 0.5);
            g.add(mesh(drawerLine, M.black, s.x0 + sx * (c + 0.5), yy + sy / 8 - 0.01, z + 0.315, false, false));
            g.add(mesh(handle, M.brass, s.x0 + sx * (c + 0.5), yy, z + 0.33, false, false));
          }
        }
    add(g, true);
    return g;
  };
  buildCabinets(solidById('cabinetsHigh'), 0.0, 2);
  buildCabinets(solidById('cabinetsLow'), 0.0, 2);

  // ---------- Archive boxes / crates ----------
  const boxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.04);
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  const crates = (s: Solid, seed: number) => {
    const g = new THREE.Group();
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    const rows = Math.max(1, Math.round(h / 0.5));
    const cols = Math.max(1, Math.round(w / 0.55));
    let k = seed;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        for (let d = 0; d < 2; d++) {
          k = (k * 9301 + 49297) % 233280;
          const rnd = k / 233280;
          const bw = w / cols;
          const bh = h / rows;
          const b = mesh(boxGeo, M.kraft, s.x0 + bw * (c + 0.5) + (rnd - 0.5) * 0.04, s.y0 + bh * (r + 0.5), -0.25 + d * -0.62, true, true);
          b.scale.set(bw * 0.97, bh * 0.97, 0.6);
          b.rotation.y = (rnd - 0.5) * 0.12;
          g.add(b);
          if (d === 0) {
            const l = mesh(new THREE.PlaneGeometry(bw * 0.4, bh * 0.25), labelMat, b.position.x, b.position.y + 0.05, b.position.z + 0.305, false, false);
            l.rotation.y = b.rotation.y;
            g.add(l);
          }
        }
    add(g, true);
  };
  crates(solidById('crateEntrance'), 3);
  crates(solidById('crateStackLow'), 7);
  crates(solidById('crateStackHigh'), 11);
  crates(solidById('crateEastHigh'), 13);
  crates(solidById('crateEastLow'), 17);

  // ---------- Security shutter portal ----------
  {
    const s = solidById('shutter');
    const cx = (s.x0 + s.x1) / 2;
    const g = new THREE.Group();
    g.add(mesh(worldBox(1.4, 10.5, 1.4), M.stone, cx, 5.25, -3.1, true, true));
    g.add(mesh(worldBox(1.4, 10.5, 1.4), M.stone, cx, 5.25, 2.7, true, true));
    g.add(mesh(worldBox(1.6, 1.5, 7.4), M.stone, cx, 10.0, -0.2, true, true));
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.2, 7.6), M.brass, cx, 9.2, -0.2, false, false));
    const shutterMat = M.steel.clone();
    (shutterMat.map as THREE.Texture).repeat.set(1, 3);
    const shutter = mesh(new THREE.BoxGeometry(0.22, 9 - s.y0, 5.0), shutterMat, cx, (9 + s.y0) / 2, -0.2, true, true);
    g.add(shutter);
    const stripes = new THREE.MeshStandardMaterial({ map: hazardStripes(), roughness: 0.7 });
    (stripes.map as THREE.Texture).repeat.set(4, 1);
    const hz = mesh(new THREE.BoxGeometry(0.26, 0.18, 5.02), stripes, cx, s.y0 + 0.09, -0.2, false, false);
    g.add(hz);
    // Grilles beside the portal.
    for (let z = 3.6; z < 9; z += 0.35) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 7, 5), M.bronzeDark, cx, 3.5, z, false, false));
    for (let z = -4.0; z > -10; z -= 0.35) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 7, 5), M.bronzeDark, cx, 3.5, z, false, false));
    add(g, true);
    occluders.push(g);
  }

  // ---------- Trading counters ----------
  const lampPools: THREE.Mesh[] = [];
  const poolTex = radialSprite('rgba(255,190,120,0.9)', 'rgba(255,190,120,0)');
  const poolMat = (color: number, opacity: number) =>
    new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const marbleTop = new THREE.MeshStandardMaterial({
    map: a.get('marble_albedo'),
    roughnessMap: a.get('marble_orm'),
    roughness: 0.8,
    metalness: 0,
    envMapIntensity: 1,
  });
  const counters = ['counterA', 'counterB', 'counterC'].map(solidById);
  counters.forEach((s, i) => {
    const g = new THREE.Group();
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    g.add(mesh(worldBox(w, s.y1 - 0.06, 1.2, 1.5), M.wood, cx, (s.y1 - 0.06) / 2, 0, true, true));
    g.add(mesh(worldBox(w + 0.14, 0.07, 1.34, 2), marbleTop, cx, s.y1 - 0.025, 0, true, true));
    // brass foot rail + kick plate + vertical Deco ribs
    const rail = new THREE.CylinderGeometry(0.03, 0.03, w + 0.1, 8).rotateZ(Math.PI / 2);
    g.add(mesh(rail, M.brass, cx, 0.22, 0.72, false, false));
    g.add(mesh(new THREE.BoxGeometry(w, 0.12, 0.02), M.brass, cx, 0.06, 0.61, false, false));
    for (let k = 1; k < 5; k++) g.add(mesh(new THREE.BoxGeometry(0.03, s.y1 - 0.25, 0.02), M.brass, s.x0 + (w * k) / 5, (s.y1 - 0.06) / 2 + 0.05, 0.61, false, false));
    // Banker's lamp
    const lx = cx + (i % 2 === 0 ? 0.55 : -0.55);
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.04, 16), M.brass, lx, s.y1 + 0.02, -0.25, false, false));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), M.brass, lx, s.y1 + 0.17, -0.25, false, false));
    const shade = new THREE.CylinderGeometry(0.11, 0.11, 0.34, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
    g.add(mesh(shade, M.greenGlass, lx, s.y1 + 0.33, -0.25, false, false));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), poolMat(0xffd59a, 0.45));
    pool.position.set(lx, s.y1 + 0.005, -0.05);
    g.add(pool);
    lampPools.push(pool);
    lights.add({ position: [lx, s.y1 + 0.28, -0.1], color: 0xffd7a0, intensity: 2.6, distance: 4.5, decay: 2 });
    // Paper stacks, ledger, phone
    for (let k = 0; k < 3; k++) {
      const st = mesh(new THREE.BoxGeometry(0.3, 0.04 + k * 0.03, 0.22), M.paperWhite, cx - 0.5 + k * 0.42, s.y1 + 0.02 + k * 0.015, 0.15 - k * 0.1, true, false);
      st.rotation.y = k * 0.4 - 0.3;
      g.add(st);
    }
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), M.velvet, cx + 0.05, s.y1 + 0.03, -0.35, true, false));
    const phone = new THREE.Group();
    phone.add(mesh(new RoundedBoxGeometry(0.2, 0.08, 0.16, 2, 0.02), M.black, 0, 0.04, 0));
    phone.add(mesh(new THREE.CapsuleGeometry(0.025, 0.16, 4, 8).rotateZ(Math.PI / 2), M.black, 0, 0.11, 0));
    phone.position.set(cx - 0.25, s.y1, -0.45);
    g.add(phone);
    add(g, true);
    // Stools behind counter (guard side).
    for (const dx of [-0.6, 0.6]) {
      const st = new THREE.Group();
      st.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), M.velvet, 0, 0.75, 0));
      st.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.75, 8), M.brass, 0, 0.37, 0));
      st.add(mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 16), M.brass, 0, 0.02, 0));
      st.position.set(cx + dx, 0, -1.05);
      if (i === 1 && dx > 0) {
        st.rotation.z = Math.PI / 2;
        st.position.y = 0.2;
      }
      add(st, true);
    }
  });

  // ---------- Mezzanine gallery ----------
  const mezz = ['mezzWest', 'mezzEast'].map(solidById);
  const balusterGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6);
  for (const s of mezz) {
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    const g = new THREE.Group();
    g.add(mesh(worldBox(w, s.y1 - s.y0, 2.6), M.stone, cx, (s.y0 + s.y1) / 2, -0.25, true, true));
    g.add(mesh(worldBox(w, 0.04, 2.6, 2), M.wood, cx, s.y1 + 0.02, -0.25, false, true));
    // Fascia frieze facing the camera
    const fz = new THREE.PlaneGeometry(w, 0.34);
    const fuv = fz.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < fuv.count; i++) fuv.setX(i, fuv.getX(i) * (w / 4));
    g.add(mesh(fz, M.frieze, cx, (s.y0 + s.y1) / 2, 1.06, false, false));
    // Front railing (camera side) — open balusters keep Leon readable.
    g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.08), M.brass, cx, s.y1 + 0.95, 0.95, false, false));
    const bal = new THREE.InstancedMesh(balusterGeo, M.bronzeDark, Math.floor(w / 0.3));
    for (let i = 0; i < bal.count; i++) {
      const m4 = new THREE.Matrix4().makeTranslation(s.x0 + 0.15 + i * 0.3, s.y1 + 0.47, 0.95);
      bal.setMatrixAt(i, m4);
    }
    g.add(bal);
    // Back parapet (hall side) — the occluder MM-01 sees from below.
    g.add(mesh(worldBox(w, 0.85, 0.22), M.stone, cx, s.y1 + 0.425, -1.45, true, true));
    g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.3), M.brass, cx, s.y1 + 0.88, -1.45, false, false));
    add(g, true);
  }
  // Broken ends of the gap: splintered planks hanging down.
  for (const [x, dir] of [
    [8.2, 1],
    [10.8, -1],
  ] as const) {
    for (let k = 0; k < 3; k++) {
      const p = mesh(new THREE.BoxGeometry(0.9, 0.05, 0.25), M.wood, x + dir * 0.2, MEZZ_Y - 0.3 - k * 0.12, -0.6 + k * 0.5, true, false);
      p.rotation.z = dir * (0.5 + k * 0.25);
      add(p, true);
    }
  }
  // Debris under the gap
  for (let k = 0; k < 6; k++) {
    const p = mesh(new THREE.BoxGeometry(0.7 + (k % 3) * 0.3, 0.05, 0.22), M.wood, 9.5 + Math.sin(k * 2.1) * 1.1, 0.05 + k * 0.01, -0.3 + Math.cos(k * 1.7) * 0.6, true, true);
    p.rotation.y = k * 0.9;
    add(p, true);
  }
  // Slim gallery posts
  const postGeo = flutedColumn(0.17, MEZZ_Y - 0.35, 10, 24);
  for (const x of [0.9, 4.5, 7.7, 11.3, 15.3, 20.4]) {
    add(mesh(postGeo, M.stone, x, (MEZZ_Y - 0.35) / 2, -1.15, true, true), true);
    add(mesh(new THREE.BoxGeometry(0.45, 0.25, 0.45), M.stone, x, MEZZ_Y - 0.47, -1.15, true, false));
  }

  // ---------- Hide spots ----------
  const booth = HIDE_SPOTS.find((h) => h.id === 'booth')!;
  const boothDoor = new THREE.Group();
  {
    const g = new THREE.Group();
    const bw = 1.15;
    const bh = 2.5;
    const bd = 1.0;
    const z = -1.15;
    // frame posts
    for (const dx of [-bw / 2, bw / 2])
      for (const dz of [-bd / 2, bd / 2]) g.add(mesh(new THREE.BoxGeometry(0.08, bh, 0.08), M.wood, booth.x + dx, bh / 2, z + dz, true, true));
    g.add(mesh(worldBox(bw + 0.2, 0.25, bd + 0.2), M.wood, booth.x, bh + 0.12, z, true, true));
    g.add(mesh(new THREE.BoxGeometry(bw + 0.24, 0.05, bd + 0.24), M.brass, booth.x, bh + 0.26, z, false, false));
    g.add(mesh(worldBox(bw, bh, 0.05), M.wood, booth.x, bh / 2, z - bd / 2, true, true));
    for (const dx of [-bw / 2, bw / 2]) {
      const side = mesh(new THREE.BoxGeometry(0.03, bh * 0.62, bd), M.glass, booth.x + dx, bh * 0.58, z, false, false);
      g.add(side);
      g.add(mesh(worldBox(0.05, bh * 0.28, bd), M.wood, booth.x + dx, bh * 0.14, z, true, true));
    }
    const sign = new THREE.MeshBasicMaterial({ map: signTexture('TELEPHONE', { w: 512, h: 96, bg: '#1d1206', fg: '#ffcf86', glow: '#ffae4a' }) });
    g.add(mesh(new THREE.PlaneGeometry(0.95, 0.18), sign, booth.x, bh + 0.12, z + bd / 2 + 0.11, false, false));
    // Phone inside
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.3, 0.12), M.black, booth.x, 1.5, z - bd / 2 + 0.08, false, false));
    // Folding door (front, camera side) — opens when Leon enters.
    const door = new THREE.Group();
    door.add(mesh(new THREE.BoxGeometry(bw - 0.1, bh * 0.62, 0.03), M.glass, (bw - 0.1) / 2, bh * 0.58, 0, false, false));
    door.add(mesh(worldBox(bw - 0.1, bh * 0.28, 0.05), M.wood, (bw - 0.1) / 2, bh * 0.14, 0, true, true));
    door.add(mesh(new THREE.BoxGeometry(bw - 0.1, 0.05, 0.06), M.wood, (bw - 0.1) / 2, bh - 0.02, 0, false, false));
    door.position.set(booth.x - bw / 2 + 0.05, 0, z + bd / 2);
    boothDoor.add(door);
    g.add(boothDoor);
    add(g, true);
  }
  const nook = HIDE_SPOTS.find((h) => h.id === 'nook')!;
  const nookDoor = new THREE.Group();
  {
    // Bank of tall archive cabinets with a recessed alcove (under the mezzanine gap).
    const g = new THREE.Group();
    for (const [x0, x1] of [
      [7.9, 8.85],
      [9.95, 10.9],
    ]) {
      const s: Solid = { id: 'v', kind: 'cabinet', x0, x1, y0: 0, y1: 3.8 };
      g.add(buildCabinets(s, -1.25, 1));
    }
    g.add(mesh(worldBox(1.1, 3.8, 0.1), M.black, nook.x, 1.9, -1.9, false, true));
    g.add(mesh(worldBox(1.15, 0.3, 0.8), M.cabinet, nook.x, 3.65, -1.35, true, true));
    const curtain = mesh(new THREE.BoxGeometry(1.05, 2.3, 0.04), M.velvet, 0.52, 1.2, 0, true, true);
    nookDoor.add(curtain);
    nookDoor.position.set(nook.x - 0.52, 0, -0.98);
    g.add(nookDoor);
    add(g, true);
  }
  const lockers = HIDE_SPOTS.find((h) => h.id === 'lockers')!;
  const lockerDoor = new THREE.Group();
  {
    const g = new THREE.Group();
    for (let k = -3; k <= 3; k++) {
      const x = lockers.x + k * 0.62;
      g.add(mesh(new RoundedBoxGeometry(0.6, 2.2, 0.6, 2, 0.02), M.cabinet, x, 1.1, -1.4, true, true));
      for (let v = 0; v < 5; v++) g.add(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.01), M.black, x, 1.75 + v * 0.06, -1.095, false, false));
    }
    const d = mesh(new THREE.BoxGeometry(0.58, 2.15, 0.03), M.cabinet, 0.29, 1.1, 0, true, true);
    lockerDoor.add(d);
    lockerDoor.position.set(lockers.x - 0.29, 0, -1.08);
    g.add(lockerDoor);
    add(g, true);
  }

  // ---------- MIRROR forecast (diegetic, cold cyan) ----------
  const fc = FORECAST.corridor;
  const stripGeo = new THREE.BoxGeometry(fc.x1 - fc.x0, 0.012, 0.05);
  const stripMat = M.cyanGlow.clone();
  add(mesh(stripGeo, stripMat, (fc.x0 + fc.x1) / 2, 0.006, 0.85, false, false));
  add(mesh(stripGeo, stripMat, (fc.x0 + fc.x1) / 2, 0.006, -0.75, false, false));
  // Chevrons along the predicted path (pointing right = predicted direction of travel)
  const chevGeo = new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2);
  const chevTex = radialSprite('rgba(90,240,255,1)', 'rgba(90,240,255,0)');
  const chevMat = new THREE.MeshBasicMaterial({ map: chevTex, color: 0x5ff2ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const chevrons: THREE.Mesh[] = [];
  for (let x = fc.x0 + 0.5; x < fc.x1; x += 1.5) {
    const c = mesh(chevGeo, chevMat.clone(), x, 0.01, 0.05, false, false);
    c.scale.set(0.6, 1, 0.25);
    add(c);
    chevrons.push(c);
  }
  // Hotspot ring in front of the booth
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ff2ff).multiplyScalar(2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = mesh(new THREE.RingGeometry(0.75, 0.82, 64).rotateX(-Math.PI / 2), ringMat, booth.x, 0.012, -0.6, false, false);
  add(ring);
  const panelTex = signTexture(`MIRROR · FORECAST  ${Math.round(FORECAST.probability * 100)}%`, { w: 1024, h: 160, bg: '#031014', fg: '#6ff3ff', glow: '#2fe0ff', font: `500 52px 'Courier New', monospace` });
  const panel = mesh(new THREE.PlaneGeometry(2.2, 0.34), new THREE.MeshBasicMaterial({ map: panelTex, color: new THREE.Color(1.4, 1.4, 1.4) }), booth.x - 0.2, 3.25, -1.62, false, false);
  add(panel);
  add(mesh(new THREE.BoxGeometry(2.35, 0.45, 0.06), M.black, booth.x - 0.2, 3.25, -1.66, false, false));
  // Sensor domes on gallery posts and colonnade
  const domeGeo = new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI);
  const ledGeo = new THREE.SphereGeometry(0.02, 6, 4);
  for (const [x, y, z] of [
    [0.9, 3.4, -0.95],
    [-9.4, 3.0, -1.2],
    [11.3, 3.4, -0.95],
    [-18, 8, BACK_COLS_Z + 1.2],
    [9, 8, BACK_COLS_Z + 1.2],
  ]) {
    add(mesh(domeGeo, M.black, x, y, z, false, false));
    add(mesh(ledGeo, M.cyanGlow, x, y - 0.1, z + 0.08, false, false));
  }
  updaters.push((t, _dt, ctx) => {
    const alert = ctx.guardMode === 'search' || ctx.guardMode === 'suspicious';
    const pulse = 0.55 + 0.45 * Math.sin(t * (alert ? 6 : 2.2));
    stripMat.opacity = 0.35 + 0.65 * pulse;
    ringMat.opacity = 0.4 + 0.6 * pulse;
    chevrons.forEach((c, i) => {
      (c.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.5 * Math.max(0, Math.sin(t * 3 - i * 0.7));
    });
  });

  // ---------- Pendant lamps (match sim light zones) ----------
  const pendantDefs = [
    { id: 'pendantBooth', z: -0.9, y: 6.6 },
    { id: 'pendantMid', z: -0.4, y: 7.6 },
    { id: 'pendantEast', z: -0.6, y: 5.6 },
  ];
  const shadeProfile = [
    new THREE.Vector2(0.05, 0.55),
    new THREE.Vector2(0.18, 0.5),
    new THREE.Vector2(0.22, 0.38),
    new THREE.Vector2(0.42, 0.28),
    new THREE.Vector2(0.48, 0.12),
    new THREE.Vector2(0.62, 0.0),
    new THREE.Vector2(0.6, -0.04),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadeProfile, 40);
  for (const d of pendantDefs) {
    const z = LIGHT_ZONES.find((l) => l.id === d.id)!;
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 40 - d.y, 4), M.bronzeDark, 0, (40 - d.y) / 2 + 0.5, 0, false, false));
    const shade = mesh(shadeGeo, M.brass, 0, 0, 0, true, false);
    (shade.material as THREE.Material).side = THREE.DoubleSide;
    g.add(shade);
    g.add(mesh(new THREE.SphereGeometry(0.17, 16, 10), M.amberGlow, 0, 0.05, 0, false, false));
    lights.add({ position: [z.x, d.y - 0.15, d.z], color: 0xffb469, intensity: 75 * z.intensity, distance: 0, decay: 2, flicker: d.id === 'pendantEast' ? 1 : 0 });
    g.position.set(z.x, d.y, d.z);
    add(g);
    // floor pool (fake bounce; also tells the player "this is lit")
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(z.radius * 2.2, z.radius * 2.2).rotateX(-Math.PI / 2), poolMat(0xffb070, 0.22));
    pool.position.set(z.x, 0.008, d.z + 0.4);
    add(pool);
  }

  // ---------- Skylight shafts (moon zones) ----------
  const shaftMat = (op: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uNoise: { value: a.get('noise') }, uOpacity: { value: op }, uColor: { value: new THREE.Color(0.62, 0.74, 1.0) } },
      vertexShader: `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; uniform sampler2D uNoise; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vWorld;
        void main(){
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          float fall = smoothstep(0.0, 0.35, vUv.y) * (0.55 + 0.45*vUv.y);
          float n = texture2D(uNoise, vec2(vUv.x*0.6 + uTime*0.01, vUv.y*0.5 - uTime*0.02)).r;
          float dust = 0.7 + 0.6*n;
          gl_FragColor = vec4(uColor * uOpacity * edge * fall * dust, 1.0);
        }`,
    });
  const shafts: THREE.ShaderMaterial[] = [];
  const skylight = (x: number, yTarget: number, zTarget: number, width: number, op: number, light: boolean) => {
    const top = new THREE.Vector3(x - MOON_DIR.x * (36 - yTarget) / -MOON_DIR.y, 36, zTarget - (MOON_DIR.z * (36 - yTarget)) / -MOON_DIR.y);
    const bottom = new THREE.Vector3(x, yTarget, zTarget);
    const len = top.distanceTo(bottom);
    for (const rot of [0, Math.PI / 2]) {
      const m = shaftMat(op);
      shafts.push(m);
      const geo = new THREE.PlaneGeometry(width, len);
      geo.translate(0, len / 2, 0);
      const me = new THREE.Mesh(geo, m);
      me.position.copy(bottom);
      me.lookAt(top);
      me.rotateX(Math.PI / 2);
      me.rotateY(rot);
      me.renderOrder = 5;
      add(me);
    }
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.4, width * 1.1).rotateX(-Math.PI / 2), poolMat(0x9fc3ff, 0.35));
    patch.position.set(x, yTarget + 0.012, zTarget);
    add(patch);
    if (light) {
      const sp = new THREE.SpotLight(0xa9c6ff, 60, 50, 0.13, 0.6, 2);
      sp.position.copy(top);
      sp.target.position.copy(bottom);
      add(sp);
      add(sp.target);
    }
  };
  const mz = LIGHT_ZONES.find((l) => l.id === 'moonShaftWest')!;
  skylight(mz.x, 0, -0.2, 2.4, 0.05, q.extraLights);
  const mm = LIGHT_ZONES.find((l) => l.id === 'moonShaftMezz')!;
  skylight(mm.x, MEZZ_Y, -0.2, 2.0, 0.04, q.extraLights);
  // Background window shafts: the colonnade bathed in moonlight.
  for (const wx of windowXs) {
    if (Math.abs(wx - clockX) < 0.1) continue;
    for (const yTop of [WINDOW_SPRING + 1.5]) {
      const startZ = BACK_WALL_Z - 0.5;
      const k = -MOON_DIR.z / MOON_DIR.y; // horizontal travel per metre of drop
      const top = new THREE.Vector3(wx, yTop, startZ);
      const bottom = new THREE.Vector3(wx + (MOON_DIR.x / -MOON_DIR.y) * yTop, 0, startZ + k * yTop);
      const len = top.distanceTo(bottom);
      const m = shaftMat(0.06);
      shafts.push(m);
      const geo = new THREE.PlaneGeometry(WINDOW_HALF_W * 2, len);
      geo.translate(0, len / 2, 0);
      const me = new THREE.Mesh(geo, m);
      me.position.copy(bottom);
      me.lookAt(top);
      me.rotateX(Math.PI / 2);
      me.renderOrder = 5;
      add(me);
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_HALF_W * 2.2, 6).rotateX(-Math.PI / 2), poolMat(0x8fb4ff, 0.16));
      patch.position.set(bottom.x, 0.01, bottom.z - 2.5);
      add(patch);
    }
  }
  updaters.push((t) => shafts.forEach((m) => (m.uniforms.uTime.value = t)));

  // ---------- Corridor + vault B-12 ----------
  {
    const g = new THREE.Group();
    const cz = -3.7;
    g.add(mesh(worldBox(20, 7, 0.4), M.stone, 34, 3.5, cz, false, true));
    g.add(mesh(worldBox(20, 2.4, 0.3), M.wood, 34, 1.2, cz + 0.33, false, true));
    g.add(mesh(new THREE.BoxGeometry(20, 0.06, 0.34), M.brass, 34, 2.43, cz + 0.36, false, false));
    g.add(mesh(worldBox(20.4, 0.4, 3.6), M.stoneDark, 34.2, 7.2, -2.0, false, false));
    g.add(mesh(new THREE.BoxGeometry(20.4, 0.12, 0.2), M.brass, 34.2, 7.0, -0.2, false, false));
    g.add(mesh(worldBox(0.6, 7.4, 21), M.stoneDark, 24.2, 11, -14.5, false, true));
    g.add(mesh(worldBox(0.6, 20, 2.4), M.stoneDark, 24.2, 17, -2.4, false, true));
    g.add(mesh(worldBox(1.0, 4.4, 30), M.stoneDark, 44.5, 2.2, -8, false, true));
    g.add(mesh(worldBox(1.0, 31.3, 30), M.stoneDark, 44.5, 6.7 + 15.65, -8, false, true));
    g.add(mesh(worldBox(1.0, 2.3, 28.2), M.stoneDark, 44.5, 5.55, -9.1 - 0.0, false, true));
    // Deco sconces + a soft key on the vault so the B-12 corner reads in the dark.
    for (const sx of [27.2, 41.6]) {
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.36, 12, 1, true), M.brass, sx, 3.4, cz + 0.45, false, false));
      g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), M.amberGlow, sx, 3.45, cz + 0.5, false, false));
      lights.add({ position: [sx, 3.3, cz + 1.0], color: 0xffb46a, intensity: 9, distance: 7, decay: 2 });
    }
    const vaultKey = new THREE.SpotLight(0xffd9a8, 40, 14, 0.45, 0.7, 2);
    vaultKey.position.set(VAULT.x - 2.5, 6.4, 2.5);
    vaultKey.target.position.set(VAULT.x, 2.2, cz);
    g.add(vaultKey, vaultKey.target);
    // Vault door
    const vx = VAULT.x;
    const door = new THREE.Group();
    const r = 2.25;
    door.add(mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.3, 64).rotateX(Math.PI / 2), M.bronzeDark, 0, 0, -0.05, false, true));
    door.add(mesh(new THREE.CylinderGeometry(r, r, 0.5, 64).rotateX(Math.PI / 2), M.brass, 0, 0, 0.15, true, true));
    door.add(mesh(new THREE.TorusGeometry(r * 0.78, 0.06, 8, 64), M.bronzeDark, 0, 0, 0.42, false, false));
    door.add(mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 32), M.bronzeDark, 0, 0, 0.55, false, false));
    for (let k = 0; k < 6; k++) {
      const spoke = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), M.bronzeDark, 0, 0, 0.55, false, false);
      spoke.rotation.z = (k / 6) * Math.PI;
      door.add(spoke);
    }
    const boltGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10).rotateX(Math.PI / 2);
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      door.add(mesh(boltGeo, M.bronzeDark, Math.cos(ang) * r * 0.9, Math.sin(ang) * r * 0.9, 0.42, false, false));
    }
    door.position.set(vx, 2.5, cz + 0.3);
    g.add(door);
    const sign = new THREE.MeshBasicMaterial({ map: signTexture('ARCHIVE  B-12', { w: 1024, h: 180, bg: '#20160b', fg: '#ffcf86', glow: '#ff9d3a' }), color: new THREE.Color(1.2, 1.2, 1.2) });
    g.add(mesh(new THREE.PlaneGeometry(2.6, 0.46), sign, vx, 5.25, cz + 0.32, false, false));
    // caged bulb
    g.add(mesh(new THREE.SphereGeometry(0.12, 12, 8), M.amberGlow, vx, 5.95, cz + 0.55, false, false));
    lights.add({ position: [vx, 5.8, cz + 0.9], color: 0xffb066, intensity: 26, distance: 0, decay: 2 });
    add(g, true);
  }

  // ---------- Foreground layer (silhouettes, fade when blocking Leon) ----------
  const fg: { obj: THREE.Mesh; x: number; mat: THREE.MeshStandardMaterial }[] = [];
  const fgShaft = flutedColumn(0.42, 34, 12, 32);
  for (const x of [-24.5, -6.5, 15.5]) {
    const mat = M.silhouette.clone();
    const c = mesh(fgShaft, mat, x, 17, 6.2, false, false);
    add(c);
    fg.push({ obj: c, x, mat });
  }
  // Velvet rope stanchions in the near foreground
  for (let x = -14; x < 24; x += 2.6) {
    const s = new THREE.Group();
    s.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), M.brass, 0, 0.47, 0));
    s.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M.brass, 0, 0.98, 0));
    s.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 16), M.brass, 0, 0.025, 0));
    s.position.set(x, 0, 3.4);
    add(s, true);
    const rope = new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0.92, 3.4), new THREE.Vector3(x + 1.3, 0.55, 3.4), new THREE.Vector3(x + 2.6, 0.92, 3.4)),
      12,
      0.025,
      6,
    );
    add(mesh(rope, M.velvet, 0, 0, 0, true, false));
  }
  // Hanging cables / chains in the foreground
  const cables: THREE.Mesh[] = [];
  for (const x of [-20, -3, 13, 29]) {
    const c = mesh(new THREE.CylinderGeometry(0.02, 0.02, 18, 4), M.silhouette, x, 18, 5.2, false, false);
    add(c);
    cables.push(c);
  }
  updaters.push((t, _dt, ctx) => {
    for (const f of fg) {
      const d = Math.abs(f.x - (ctx.leonX + (ctx.camX - ctx.leonX) * 0.4));
      const target = d < 3.2 || ctx.camZ > 22 ? 0.1 : 1;
      f.mat.opacity += (target - f.mat.opacity) * 0.12;
      f.mat.depthWrite = f.mat.opacity > 0.95;
    }
    cables.forEach((c, i) => (c.rotation.z = Math.sin(t * 0.4 + i) * 0.015));
  });

  // ---------- Paper litter (instanced, 4 variants from the atlas) ----------
  const paperMatBase = new THREE.MeshStandardMaterial({ map: a.get('paper_atlas'), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide });
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let v = 0; v < 4; v++) {
    const geo = new THREE.PlaneGeometry(0.21, 0.29).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + (v % 2) * 0.5, uv.getY(i) * 0.5 + (1 - Math.floor(v / 2)) * 0.5 - 0.5 + 0.5);
    const n = q.paperCount;
    const im = new THREE.InstancedMesh(geo, paperMatBase, n);
    const m4 = new THREE.Matrix4();
    const qq = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const x = -30 + rnd() * 72;
      const z = -18 + rnd() * 24;
      const lift = rnd() < 0.15 ? 0.03 : 0.004;
      qq.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.15, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.15));
      m4.compose(new THREE.Vector3(x, lift + rnd() * 0.004, z), qq, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
    }
    im.receiveShadow = true;
    add(im);
  }
  // Falling sheets drifting through the light
  const falling: { m: THREE.Mesh; x: number; z: number; ph: number; sp: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const geo = new THREE.PlaneGeometry(0.21, 0.29);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.5, uv.getY(k) * 0.5 + 0.5);
    const m = new THREE.Mesh(geo, paperMatBase);
    const x = -22 + i * 6.5 + rnd() * 2;
    const z = -9 + rnd() * 8;
    falling.push({ m, x, z, ph: rnd() * 100, sp: 0.35 + rnd() * 0.25 });
    add(m);
  }
  updaters.push((t) => {
    for (const f of falling) {
      const tt = t * f.sp + f.ph;
      const h = 24 - ((tt * 1.2) % 24);
      f.m.position.set(f.x + Math.sin(tt * 1.3) * 1.2, h, f.z + Math.cos(tt * 0.9) * 0.6);
      f.m.rotation.set(Math.sin(tt * 2.1) * 1.2, tt * 0.7, Math.cos(tt * 1.7) * 0.9);
    }
  });

  // ---------- Dust motes ----------
  const dustCount = q.dustCount;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustCount * 3);
  const dr = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dp[i * 3] = rnd() * 40 - 20;
    dp[i * 3 + 1] = rnd() * 16;
    dp[i * 3 + 2] = -12 + rnd() * 16;
    dr[i] = rnd();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('aRand', new THREE.BufferAttribute(dr, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCamX: { value: 0 }, uPix: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `attribute float aRand; uniform float uTime; uniform float uCamX; uniform float uPix; varying float vA;
      void main(){
        vec3 p = position;
        p.x = mod(p.x - uCamX + 20.0 + sin(uTime*0.1 + aRand*30.0)*0.6, 40.0) - 20.0 + uCamX;
        p.y = mod(p.y + uTime*(0.05 + aRand*0.08), 16.0);
        p.z += cos(uTime*0.13 + aRand*20.0)*0.4;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = (0.9 + aRand*1.6) * uPix * (14.0 / -mv.z);
        vA = 0.35 + 0.65*sin(uTime*(0.5+aRand) + aRand*10.0)*0.5 + 0.5;
      }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord-0.5; float d = dot(c,c); if(d>0.25) discard; gl_FragColor = vec4(vec3(1.0,0.9,0.75)*vA*0.22*(1.0-d*4.0), 1.0); }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  add(dust);
  updaters.push((t, _dt, ctx) => {
    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uCamX.value = ctx.camX;
  });

  // ---------- Atmospheric haze cards (depth separation) ----------
  const hazeMat = (color: THREE.Color, op: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uNoise: { value: a.get('noise') }, uColor: { value: color }, uOpacity: { value: op } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime; uniform sampler2D uNoise; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
        void main(){
          float low = pow(1.0 - vUv.y, 2.2);
          float n = texture2D(uNoise, vec2(vUv.x*3.0 + uTime*0.004, vUv.y*0.8)).g;
          float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          gl_FragColor = vec4(uColor * uOpacity * (0.35 + low) * (0.6 + 0.8*n) * edge, 1.0);
        }`,
    });
  const hazes: THREE.ShaderMaterial[] = [];
  for (const [z, h, col, op] of [
    [-20, 30, new THREE.Color(0.32, 0.42, 0.62), 0.055],
    [-11, 18, new THREE.Color(0.38, 0.4, 0.5), 0.03],
    [-5.5, 7, new THREE.Color(0.55, 0.42, 0.3), 0.022],
  ] as const) {
    const m = hazeMat(col, op);
    hazes.push(m);
    const me = mesh(new THREE.PlaneGeometry(HALL_X1 - HALL_X0, h), m, (HALL_X0 + HALL_X1) / 2, h / 2, z, false, false);
    me.renderOrder = 4;
    add(me);
  }
  updaters.push((t) => hazes.forEach((m) => (m.uniforms.uTime.value = t)));

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0x6a7fae, 0x2a1d10, 0.6);
  add(hemi);
  const moon = new THREE.DirectionalLight(0xb8ccff, 2.1);
  moon.position.copy(MOON_DIR.clone().multiplyScalar(-40));
  moon.castShadow = q.shadows;
  moon.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  const sc = moon.shadow.camera;
  sc.left = -20;
  sc.right = 20;
  sc.top = 16;
  sc.bottom = -16;
  sc.near = 1;
  sc.far = 90;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  add(moon);
  add(moon.target);

  // ---------- Environment scene for reflections ----------
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b0f18);
  const envBox = new THREE.Mesh(new THREE.BoxGeometry(80, 40, 60), new THREE.MeshBasicMaterial({ color: 0x141a26, side: THREE.BackSide }));
  envBox.position.set(0, 18, -5);
  envScene.add(envBox);
  for (let x = -30; x <= 30; x += 9) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 15), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 0.7) }));
    w.position.set(x, 14, -34);
    envScene.add(w);
  }
  for (const x of [-9, 0, 9, 18]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.3) }));
    l.position.set(x, 7, 0);
    envScene.add(l);
  }
  const tk = new THREE.Mesh(new THREE.PlaneGeometry(36, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.6, 0.2) }));
  tk.position.set(5, 13, -10);
  envScene.add(tk);

  // Shadow camera follows the action (texel-snapped to avoid shimmering).
  const texel = (sc.right - sc.left) / q.shadowSize;
  const update = (t: number, dt: number, ctx: HallFrameContext) => {
    const cx = Math.round(ctx.leonX / texel) * texel;
    const cy = Math.round(ctx.leonY / texel) * texel;
    moon.target.position.set(cx, cy, 0);
    moon.position.set(cx, cy, 0).addScaledVector(MOON_DIR, -45);
    for (const u of updaters) u(t, dt, ctx);
    // Hide-spot doors: animate open/closed.
    const bd = boothDoor.children[0];
    const open = ctx.hiddenIn === 'booth' ? -1.35 : 0;
    bd.rotation.y += (open - bd.rotation.y) * Math.min(1, dt * 6);
    const nd = nookDoor.children[0];
    nd.scale.x += ((ctx.hiddenIn === 'nook' ? 1 : 0.35) - nd.scale.x) * Math.min(1, dt * 5);
    const ld = lockerDoor.children[0];
    const lopen = ctx.hiddenIn === 'lockers' ? 0 : -1.2;
    ld.rotation.y += (lopen - ld.rotation.y) * Math.min(1, dt * 6);
  };

  void setUV2;
  return { root, update, moon, shadowCasters: casters, boothDoor, nookDoor, lockerDoor, envScene, occluders };
}
