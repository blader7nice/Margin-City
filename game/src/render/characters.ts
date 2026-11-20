import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { GuardState, LeonState } from '../sim/types';
import { GUARD_LANE_Z, HIDE_SPOTS, LEON_LANE_Z } from '../sim/level';

/**
 * Procedural, stylised characters (placeholder-quality but readable at gameplay distance).
 * Built from smooth primitives on a joint hierarchy; animated procedurally from simulation state.
 * This is NOT the target art for close-ups — see the production pipeline note in the report.
 */

const std = (color: number, rough = 0.8, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A limb segment hanging down from its pivot. */
function segment(len: number, r0: number, r1: number, mat: THREE.Material): { pivot: THREE.Group; mesh: THREE.Mesh } {
  const pivot = new THREE.Group();
  const geo = new THREE.CapsuleGeometry((r0 + r1) / 2, Math.max(0.01, len - (r0 + r1)), 4, 10);
  const m = part(geo, mat, 0, -len / 2, 0);
  // taper
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + len / 2) / len; // 0 bottom .. 1 top
    const k = (r1 + (r0 - r1) * t) / ((r0 + r1) / 2);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  pivot.add(m);
  return { pivot, mesh: m };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, k: number, dt: number) => lerp(a, b, 1 - Math.exp(-k * dt));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- Scarf (verlet ribbon)
export class Scarf {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private prev: THREE.Vector3[] = [];
  private readonly seg = 0.075;
  private readonly n = 9;
  private readonly geo: THREE.BufferGeometry;
  private readonly pos: Float32Array;

  constructor(mat: THREE.Material) {
    for (let i = 0; i < this.n; i++) {
      this.pts.push(new THREE.Vector3(0, -i * this.seg, 0));
      this.prev.push(new THREE.Vector3(0, -i * this.seg, 0));
    }
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i < this.n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  reset(anchor: THREE.Vector3): void {
    for (let i = 0; i < this.n; i++) {
      this.pts[i].set(anchor.x, anchor.y - i * this.seg, anchor.z);
      this.prev[i].copy(this.pts[i]);
    }
  }

  update(anchor: THREE.Vector3, dt: number, t: number, windX: number): void {
    const g = -9.8 * dt * dt;
    this.pts[0].copy(anchor);
    this.prev[0].copy(anchor);
    for (let i = 1; i < this.n; i++) {
      const p = this.pts[i];
      const v = p.clone().sub(this.prev[i]).multiplyScalar(0.94);
      this.prev[i].copy(p);
      p.add(v);
      p.y += g;
      p.x += windX * dt * dt * (0.6 + 0.4 * Math.sin(t * 7 + i));
      p.z += Math.sin(t * 3.1 + i * 0.7) * 0.4 * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < this.n; i++) {
        const a = this.pts[i - 1];
        const b = this.pts[i];
        const d = b.clone().sub(a);
        const len = d.length() || 1e-6;
        const diff = (len - this.seg) / len;
        if (i === 1) b.addScaledVector(d, -diff);
        else {
          a.addScaledVector(d, diff * 0.5);
          b.addScaledVector(d, -diff * 0.5);
        }
      }
      this.pts[0].copy(anchor);
    }
    const side = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < this.n; i++) {
      const a = this.pts[Math.max(0, i - 1)];
      const b = this.pts[Math.min(this.n - 1, i + 1)];
      dir.copy(b).sub(a).normalize();
      side.crossVectors(dir, zAxis).normalize();
      if (side.lengthSq() < 0.01) side.set(1, 0, 0);
      const w = 0.055 * (1 - (i / this.n) * 0.25);
      const p = this.pts[i];
      this.pos.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w], i * 6);
      this.pos.set([p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], i * 6 + 3);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------- Leon
export class LeonRig {
  readonly root = new THREE.Group();
  private readonly yaw = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  private readonly legs: { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group }[] = [];
  private readonly scarf: Scarf;
  private readonly scarfAnchor = new THREE.Object3D();
  private phase = 0;
  private crouch = 0;
  private run = 0;
  private yawCur = 1.15;
  private landT = 1;
  private landK = 0;
  private z = LEON_LANE_Z;
  private lookYaw = 0;
  private first = true;

  constructor() {
    const skin = std(0xd9a47c, 0.7);
    const hair = std(0x2a1c13, 0.85);
    const jacket = std(0x31465c, 0.82);
    const jacketDark = std(0x24344a, 0.85);
    const hood = std(0x8a8f8c, 0.9);
    const trousers = std(0x2a2b31, 0.85);
    const shoe = std(0x5b3a22, 0.6);
    const sole = std(0xd8cfbf, 0.8);
    const scarfMat = std(0xc9802f, 0.92, 0, { side: THREE.DoubleSide });
    const bag = std(0x6b5134, 0.75);
    const dark = std(0x111111, 0.4);

    this.root.add(this.yaw);
    this.yaw.add(this.hips);
    this.hips.position.y = 0.93;
    // pelvis
    this.hips.add(part(new RoundedBoxGeometry(0.3, 0.16, 0.2, 2, 0.06), trousers, 0, -0.02, 0));
    // torso
    this.hips.add(this.torso);
    this.torso.add(part(new THREE.CapsuleGeometry(0.155, 0.25, 4, 12).scale(1.08, 1, 0.74), jacket, 0, 0.24, 0));
    this.torso.add(part(new THREE.CapsuleGeometry(0.16, 0.06, 4, 12).scale(1.1, 0.7, 0.78), jacketDark, 0, 0.06, 0)); // jacket hem
    this.torso.add(part(new THREE.TorusGeometry(0.1, 0.045, 8, 16).rotateX(Math.PI / 2), hood, 0, 0.47, -0.03)); // hood collar
    // zipper line + pocket accents
    this.torso.add(part(new THREE.BoxGeometry(0.012, 0.36, 0.01), dark, 0, 0.24, 0.118));
    // backpack
    this.torso.add(part(new RoundedBoxGeometry(0.27, 0.34, 0.13, 3, 0.05), bag, 0, 0.27, -0.17));
    this.torso.add(part(new RoundedBoxGeometry(0.2, 0.12, 0.06, 2, 0.03), bag, 0, 0.17, -0.25));
    for (const sx of [-0.09, 0.09]) this.torso.add(part(new THREE.BoxGeometry(0.035, 0.34, 0.25), bag, sx, 0.3, -0.02));
    // neck + scarf wrap
    this.torso.add(part(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, 0, 0.5, 0));
    this.torso.add(part(new THREE.TorusGeometry(0.075, 0.042, 8, 18).rotateX(Math.PI / 2), scarfMat, 0, 0.48, 0.01));
    this.scarfAnchor.position.set(0.04, 0.44, -0.07);
    this.torso.add(this.scarfAnchor);
    // head
    this.head.position.set(0, 0.56, 0.01);
    this.torso.add(this.head);
    this.head.add(part(new THREE.SphereGeometry(0.118, 24, 18).scale(0.92, 1.07, 1.0), skin, 0, 0.11, 0));
    this.head.add(part(new THREE.SphereGeometry(0.03, 10, 8).scale(0.8, 1, 0.9), skin, 0, 0.09, 0.115)); // nose
    for (const sx of [-0.042, 0.042]) {
      this.head.add(part(new THREE.SphereGeometry(0.014, 8, 6), dark, sx, 0.125, 0.1));
      this.head.add(part(new THREE.BoxGeometry(0.04, 0.008, 0.01), hair, sx, 0.155, 0.104));
      this.head.add(part(new THREE.SphereGeometry(0.022, 8, 6).scale(0.6, 1, 0.8), skin, sx * 2.55, 0.11, -0.01)); // ears
    }
    // hair: cap + tufts
    this.head.add(part(new THREE.SphereGeometry(0.128, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(0.97, 1.0, 1.06), hair, 0, 0.13, -0.012));
    const tufts = [
      [0.03, 0.235, 0.05, 0.05],
      [-0.05, 0.23, 0.03, 0.048],
      [0.07, 0.2, -0.02, 0.045],
      [-0.07, 0.2, -0.05, 0.046],
      [0.0, 0.225, -0.07, 0.05],
      [0.04, 0.21, 0.09, 0.035],
    ];
    for (const [x, y, z, r] of tufts) this.head.add(part(new THREE.SphereGeometry(r, 10, 8).scale(1.2, 0.7, 1.1), hair, x, y, z));
    // arms
    for (const side of [1, -1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.2, 0.42, 0);
      this.torso.add(sh);
      sh.add(part(new THREE.SphereGeometry(0.065, 12, 10), jacket, 0, 0, 0));
      const up = segment(0.29, 0.058, 0.05, jacket);
      sh.add(up.pivot);
      const el = new THREE.Group();
      el.position.y = -0.28;
      up.pivot.add(el);
      const fo = segment(0.26, 0.05, 0.042, jacket);
      el.add(fo.pivot);
      fo.pivot.add(part(new THREE.SphereGeometry(0.043, 10, 8).scale(0.9, 1.15, 0.7), skin, 0, -0.29, 0));
      fo.pivot.add(part(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), jacketDark, 0, -0.235, 0));
      this.arms.push({ sh, el });
    }
    // legs
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, -0.05, 0);
      this.hips.add(hip);
      const th = segment(0.42, 0.078, 0.06, trousers);
      hip.add(th.pivot);
      const knee = new THREE.Group();
      knee.position.y = -0.41;
      th.pivot.add(knee);
      const sh = segment(0.41, 0.058, 0.046, trousers);
      knee.add(sh.pivot);
      const ankle = new THREE.Group();
      ankle.position.y = -0.41;
      sh.pivot.add(ankle);
      ankle.add(part(new RoundedBoxGeometry(0.1, 0.085, 0.24, 2, 0.035), shoe, 0, -0.035, 0.045));
      ankle.add(part(new RoundedBoxGeometry(0.105, 0.025, 0.25, 2, 0.01), sole, 0, -0.075, 0.045));
      this.legs.push({ hip, knee, ankle });
    }
    this.scarf = new Scarf(scarfMat);
    const rim = new THREE.PointLight(0xa8c0ff, 7, 3.2, 2);
    rim.position.set(0, 2.1, -1.1);
    this.root.add(rim);
    const fill = new THREE.PointLight(0xffc89a, 2.6, 3.2, 2);
    fill.position.set(0, 1.4, 1.6);
    this.root.add(fill);
    this.fill = fill;
    this.rim = rim;
  }
  private fill: THREE.PointLight;
  private rim: THREE.PointLight;

  /** Scarf lives in world space (it must lag behind the body). Add it to the scene separately. */
  get scarfMesh(): THREE.Mesh {
    return this.scarf.mesh;
  }

  update(l: LeonState, dt: number, t: number, threat: { x: number; y: number; active: boolean } | null): void {
    const speed = Math.abs(l.vx);
    // Readability: the darker Leon's surroundings, the stronger his soft personal fill (never flat-lit).
    const dark = 1 - Math.min(1, l.light * 1.4);
    this.fill.intensity = 2.0 + dark * 3.2;
    this.rim.intensity = 6 + dark * 4;
    const hiddenSpot = l.hideId ? HIDE_SPOTS.find((h) => h.id === l.hideId) : undefined;

    // Depth: step back into the hiding place.
    let targetZ = LEON_LANE_Z;
    if ((l.mode === 'enterHide' || l.mode === 'hidden') && hiddenSpot) targetZ = hiddenSpot.depthZ;
    this.z = damp(this.z, targetZ, l.mode === 'enterHide' || l.mode === 'exitHide' ? 9 : 14, dt);
    this.root.position.set(l.x, l.y, this.z);

    // Facing: 3/4 toward the camera so the face stays readable.
    let yawTarget = l.facing > 0 ? 1.12 : -1.12;
    if (l.mode === 'mantle') yawTarget = l.facing > 0 ? 1.45 : -1.45;
    if (l.mode === 'hidden' || l.mode === 'enterHide') yawTarget = 0;
    if (l.mode === 'finished') yawTarget = Math.PI * 0.92;
    if (l.mode === 'caught') yawTarget = l.facing > 0 ? 0.6 : -0.6;
    this.yawCur = damp(this.yawCur, yawTarget, 12, dt);
    this.yaw.rotation.y = this.yawCur;

    const grounded = l.grounded || l.mode === 'hidden' || l.mode === 'enterHide';
    this.crouch = damp(this.crouch, l.crouching ? 1 : l.mode === 'hidden' ? 0.35 : 0, 10, dt);
    this.run = damp(this.run, clamp((speed - 3.1) / 2.2, 0, 1), 8, dt);
    const moveK = clamp(speed / 1.2, 0, 1);
    const freq = l.crouching ? 1.15 * (speed / 1.5) : speed < 3.3 ? 1.75 * (speed / 3) : 2.45 + (speed - 3.3) * 0.1;
    if (grounded) this.phase += dt * Math.PI * 2 * freq;
    if (l.mode !== 'normal') this.phase = damp(this.phase, Math.round(this.phase / Math.PI) * Math.PI, 6, dt);

    // landing squash
    this.landT += dt;
    const landSquash = this.landT < 0.22 ? Math.sin((this.landT / 0.22) * Math.PI) * this.landK : 0;

    const ph = this.phase;
    const swingA = lerp(0.48, 0.92, this.run) * moveK * (1 - this.crouch * 0.4);
    const sL = Math.sin(ph);
    const sR = Math.sin(ph + Math.PI);
    const breath = Math.sin(t * 2.1) * 0.012;

    let hipY = 0.93 - this.crouch * 0.36 - Math.abs(Math.cos(ph)) * 0.045 * moveK * (0.6 + this.run) - landSquash * 0.16;
    let lean = 0.05 + this.run * 0.24 + this.crouch * 0.5 + landSquash * 0.3;
    const thigh = [-sL * swingA, -sR * swingA];
    const knee = [0, 0];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? sL : sR;
      const c = Math.cos(ph + (i === 0 ? 0 : Math.PI));
      knee[i] = (0.1 + Math.max(0, -c) * lerp(0.7, 1.4, this.run) * moveK + Math.max(0, s) * 0.15 * moveK);
      thigh[i] += -this.crouch * 1.05;
      knee[i] += this.crouch * 1.75;
    }
    let shoulder = [sR * swingA * 0.85, sL * swingA * 0.85];
    let elbow = [-(0.25 + this.run * 1.05 + this.crouch * 0.5), -(0.25 + this.run * 1.05 + this.crouch * 0.5)];
    let shoulderZ = 0.07 + this.crouch * 0.12;
    let headTilt = -lean * 0.5;

    if (!grounded && l.mode === 'normal') {
      const up = clamp(l.vy / 7.6, -1, 1);
      if (up > 0) {
        thigh[0] = -0.95;
        thigh[1] = -0.35;
        knee[0] = 1.45;
        knee[1] = 0.6;
        shoulder = [-0.9, 0.5];
        elbow = [-0.9, -0.5];
      } else {
        thigh[0] = -0.45;
        thigh[1] = 0.1;
        knee[0] = 0.5;
        knee[1] = 0.25;
        shoulder = [-1.2, -0.8];
        shoulderZ = 0.45;
        elbow = [-0.3, -0.3];
      }
      lean = 0.15;
    }
    if (l.mode === 'mantle') {
      const k = clamp(l.modeT / 0.44, 0, 1);
      shoulder = [lerp(-2.9, -0.6, k), lerp(-2.9, -0.6, k)];
      elbow = [lerp(-0.2, -1.6, k), lerp(-0.2, -1.6, k)];
      thigh[0] = -1.3;
      thigh[1] = lerp(-0.2, -1.1, k);
      knee[0] = 1.8;
      knee[1] = lerp(0.4, 1.6, k);
      lean = lerp(0.1, 0.65, k);
      hipY = lerp(0.85, 0.7, k);
    }
    if (l.mode === 'hidden' || l.mode === 'enterHide') {
      shoulder = [0.15, 0.15];
      elbow = [-1.9, -1.9];
      shoulderZ = 0.3;
      headTilt = 0.15;
    }
    if (l.pushing) {
      // Lean into the heavy cart, arms forward, short steps.
      shoulder = [-1.35, -1.25];
      elbow = [-0.35, -0.4];
      lean = 0.55;
      shoulderZ = 0.12;
      hipY -= 0.05;
    }
    if (l.slideT > 0) {
      // Slide: hips low, lead leg forward, trailing knee bent, arms back for balance.
      hipY = 0.42;
      lean = -0.35;
      thigh[0] = -1.35;
      knee[0] = 0.25;
      thigh[1] = -0.5;
      knee[1] = 1.9;
      shoulder = [0.6, 0.9];
      elbow = [-0.6, -0.4];
      shoulderZ = 0.35;
    }
    if (l.mode === 'caught') {
      shoulder = [-2.3, -2.1];
      elbow = [-0.6, -0.5];
      lean = -0.25;
      shoulderZ = 0.4;
    }

    this.hips.position.y = hipY + breath * 0.3;
    this.torso.rotation.x = lean + breath;
    this.hips.rotation.y = Math.sin(ph) * 0.08 * moveK;
    this.torso.rotation.y = -Math.sin(ph) * 0.14 * moveK;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      this.legs[i].hip.rotation.x = thigh[i] - lean * 0.6 * (1 - this.crouch);
      this.legs[i].knee.rotation.x = knee[i];
      this.legs[i].ankle.rotation.x = -knee[i] * 0.35 + this.crouch * 0.2;
      this.arms[i].sh.rotation.x = shoulder[i];
      this.arms[i].sh.rotation.z = side * shoulderZ;
      this.arms[i].el.rotation.x = elbow[i];
    }

    // Head: glance at MM-01 when he is close and alert (emotion + readability).
    let lookTarget = 0;
    if (threat && threat.active && l.mode !== 'caught') {
      const worldAng = Math.atan2(threat.x - l.x, 2.5);
      lookTarget = clamp(worldAng - this.yawCur, -0.9, 0.9);
    }
    this.lookYaw = damp(this.lookYaw, lookTarget, 6, dt);
    this.head.rotation.y = this.lookYaw;
    this.head.rotation.x = headTilt;

    // landing trigger
    if (l.lastLandingSpeed > 0 && l.grounded && this.landT > 0.3 && l.airTime === 0 && this.wasAir) {
      this.landT = 0;
      this.landK = clamp(l.lastLandingSpeed / 10, 0.25, 1);
    }
    this.wasAir = !l.grounded && l.mode === 'normal';

    // Scarf in world space.
    this.root.updateMatrixWorld(true);
    const anchor = this.scarfAnchor.getWorldPosition(new THREE.Vector3());
    if (this.first) {
      this.scarf.reset(anchor);
      this.first = false;
    }
    this.scarf.update(anchor, Math.min(dt, 1 / 30), t, -l.vx * 3 - 0.6);
  }
  private wasAir = false;

  snap(): void {
    this.first = true;
  }
}

// ---------------------------------------------------------------- MM-01
export const EYE_COLORS: Record<string, THREE.Color> = {
  patrol: new THREE.Color(0x63f3ff),
  return: new THREE.Color(0x63f3ff),
  suspicious: new THREE.Color(0xffb13a),
  search: new THREE.Color(0xffb13a),
  chase: new THREE.Color(0xff3247),
};

export class InspectorRig {
  readonly root = new THREE.Group();
  private readonly yaw = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  readonly head = new THREE.Group();
  private readonly coat = new THREE.Group();
  private readonly arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  private readonly legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  readonly eyeLight: THREE.SpotLight;
  private readonly eyeMat: THREE.MeshBasicMaterial;
  private readonly lineMat: THREE.MeshBasicMaterial;
  private readonly cone: THREE.Mesh;
  private readonly coneMat: THREE.ShaderMaterial;
  private phase = 0;
  private yawCur = -1.2;
  private headYaw = 0;
  private eyeColor = new THREE.Color(0x63f3ff);
  readonly eyeWorld = new THREE.Vector3();

  constructor(eyeShadow: boolean) {
    const coatMat = std(0x2b2e34, 0.62, 0.15, { envMapIntensity: 0.8 });
    const coatDark = std(0x1d1f24, 0.7);
    const skin = std(0xc8ad9c, 0.62);
    const metal = std(0x9aa5b1, 0.28, 1.0, { envMapIntensity: 1.3 });
    const metalDark = std(0x3c434c, 0.35, 1.0);
    const hair = std(0x15151a, 0.6);
    const glove = std(0x101114, 0.5);
    const boot = std(0x0c0c0e, 0.35, 0.2);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x63f3ff).multiplyScalar(4) });
    this.lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x63f3ff).multiplyScalar(2.2) });

    this.root.add(this.yaw);
    this.yaw.add(this.hips);
    this.hips.position.y = 1.08;
    this.hips.add(this.torso);
    // chest/shoulders under the coat
    this.torso.add(part(new THREE.CapsuleGeometry(0.2, 0.36, 4, 14).scale(1.15, 1, 0.72), coatMat, 0, 0.34, 0));
    this.torso.add(part(new THREE.CapsuleGeometry(0.11, 0.48, 4, 10).rotateZ(Math.PI / 2), coatMat, 0, 0.6, -0.01)); // shoulder line
    // long coat (lathe), hangs from the chest and sways
    const prof = [
      new THREE.Vector2(0.0, 0.66),
      new THREE.Vector2(0.24, 0.64),
      new THREE.Vector2(0.26, 0.4),
      new THREE.Vector2(0.25, 0.05),
      new THREE.Vector2(0.29, -0.4),
      new THREE.Vector2(0.34, -0.78),
      new THREE.Vector2(0.36, -0.86),
    ];
    const coatGeo = new THREE.LatheGeometry(prof, 40).scale(1, 1, 0.74);
    const coatMesh = part(coatGeo, coatMat, 0, 0, 0);
    (coatMesh.material as THREE.Material).side = THREE.DoubleSide;
    this.coat.add(coatMesh);
    // coat front seam, belt, lapels
    this.coat.add(part(new THREE.BoxGeometry(0.012, 1.4, 0.01), coatDark, 0.04, -0.12, 0.215));
    this.coat.add(part(new THREE.BoxGeometry(0.56, 0.05, 0.4), coatDark, 0, 0.0, 0));
    this.coat.add(part(new THREE.BoxGeometry(0.06, 0.05, 0.02), metal, 0, 0.0, 0.2));
    for (const sx of [-1, 1]) {
      const lap = part(new THREE.BoxGeometry(0.1, 0.3, 0.02), coatDark, sx * 0.08, 0.48, 0.19);
      lap.rotation.z = sx * 0.25;
      this.coat.add(lap);
    }
    this.torso.add(this.coat);
    // high collar
    this.torso.add(part(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 18, 1, true), coatDark, 0, 0.74, -0.01));
    // neck
    this.torso.add(part(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 10), skin, 0, 0.78, 0));

    // HEAD — half human (left), half cybernetic (right). Visible features, no visor.
    this.head.position.set(0, 0.86, 0.01);
    this.torso.add(this.head);
    const R = 0.115;
    // phi ∈ [π/2, 3π/2] → x ≥ 0 (his left, human); the other half (x ≤ 0, his right) is cybernetic.
    const humanHalf = new THREE.SphereGeometry(R, 24, 18, Math.PI / 2, Math.PI).scale(0.9, 1.12, 1.0);
    const metalHalf = new THREE.SphereGeometry(R * 1.015, 24, 18, -Math.PI / 2, Math.PI).scale(0.9, 1.12, 1.0);
    this.head.add(part(humanHalf, skin, 0, 0.12, 0));
    this.head.add(part(metalHalf, metal, 0, 0.12, 0));
    // human side: eye, brow, cheekbone, slicked hair
    this.head.add(part(new THREE.SphereGeometry(0.013, 8, 6), std(0x222020, 0.3), 0.04, 0.135, 0.1));
    this.head.add(part(new THREE.BoxGeometry(0.045, 0.009, 0.012), hair, 0.042, 0.16, 0.103));
    this.head.add(part(new THREE.SphereGeometry(R * 1.03, 20, 12, Math.PI / 2, Math.PI, 0, Math.PI * 0.42).scale(0.9, 1.1, 1.02), hair, 0, 0.125, -0.005));
    this.head.add(part(new THREE.SphereGeometry(0.026, 8, 6).scale(0.8, 1, 0.9), skin, 0.0, 0.1, 0.112)); // nose (centre)
    this.head.add(part(new THREE.BoxGeometry(0.05, 0.007, 0.01), std(0x6e4b46, 0.6), 0.0, 0.055, 0.106)); // thin mouth
    // cyber side: eye implant, ring, temple disc, jaw plate, light seams
    const eye = part(new THREE.SphereGeometry(0.019, 12, 8), this.eyeMat, -0.042, 0.135, 0.1);
    this.head.add(eye);
    this.head.add(part(new THREE.TorusGeometry(0.03, 0.007, 6, 18), metalDark, -0.042, 0.135, 0.1));
    this.head.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16).rotateZ(Math.PI / 2), metalDark, -0.1, 0.14, 0.0)); // temple
    this.head.add(part(new THREE.BoxGeometry(0.06, 0.035, 0.09), metalDark, -0.06, 0.04, 0.05)); // jaw plate
    for (const [y, z, w] of [
      [0.19, 0.06, 0.06],
      [0.09, 0.08, 0.05],
      [0.05, 0.02, 0.04],
    ]) {
      const s = part(new THREE.BoxGeometry(w, 0.004, 0.004), this.lineMat, -0.07, y, z);
      s.rotation.y = -0.6;
      this.head.add(s);
    }

    // arms (gloved), coat sleeves
    for (const side of [1, -1]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.27, 0.58, 0);
      this.torso.add(sh);
      const up = segment(0.34, 0.065, 0.055, coatMat);
      sh.add(up.pivot);
      const el = new THREE.Group();
      el.position.y = -0.33;
      up.pivot.add(el);
      const fo = segment(0.3, 0.055, 0.05, coatMat);
      el.add(fo.pivot);
      fo.pivot.add(part(new THREE.SphereGeometry(0.048, 10, 8).scale(0.85, 1.2, 0.7), glove, 0, -0.33, 0));
      this.arms.push({ sh, el });
    }
    // legs (only the shins really show below the coat)
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, -0.02, 0);
      this.hips.add(hip);
      const th = segment(0.5, 0.08, 0.065, coatDark);
      hip.add(th.pivot);
      const knee = new THREE.Group();
      knee.position.y = -0.49;
      th.pivot.add(knee);
      const sh = segment(0.5, 0.062, 0.05, coatDark);
      knee.add(sh.pivot);
      sh.pivot.add(part(new RoundedBoxGeometry(0.11, 0.1, 0.27, 2, 0.035), boot, 0, -0.5, 0.05));
      this.legs.push({ hip, knee });
    }

    // Eye light: the vision is diegetic. Spot + soft visible cone.
    this.eyeLight = new THREE.SpotLight(0x8ff6ff, 26, 16, 0.36, 0.55, 1.6);
    this.eyeLight.castShadow = eyeShadow;
    this.eyeLight.shadow.mapSize.set(512, 512);
    this.eyeLight.shadow.bias = -0.0008;
    this.eyeLight.position.set(-0.042, 0.135, 0.12);
    this.head.add(this.eyeLight);
    const tgt = new THREE.Object3D();
    tgt.position.set(-0.042, 0.02, 2.0);
    this.head.add(tgt);
    this.eyeLight.target = tgt;

    // Strong cold rim + faint coat sheen: MM-01 must read as a silhouette even in deep shadow.
    coatMat.emissive = new THREE.Color(0x0a0e16);
    const rim = new THREE.PointLight(0x9db8ff, 10, 3.6, 2);
    rim.position.set(0, 2.3, -0.9);
    this.root.add(rim);
    this.coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0x63f3ff) }, uOpacity: { value: 0.16 } },
      vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vT; varying vec3 vN; varying vec3 vV;
        void main(){ float fres = pow(1.0 - abs(dot(vN, vV)), 2.5); float along = pow(vT, 2.2); gl_FragColor = vec4(uColor * uOpacity * along * (0.15 + fres), 1.0); }`,
    });
    const coneLen = 6.5;
    const coneGeo = new THREE.ConeGeometry(Math.tan(0.24) * coneLen, coneLen, 32, 1, true);
    coneGeo.translate(0, -coneLen / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);
    this.cone = new THREE.Mesh(coneGeo, this.coneMat);
    this.cone.position.set(-0.042, 0.135, 0.11);
    this.cone.rotation.x = 0.0;
    this.cone.renderOrder = 6;
    this.head.add(this.cone);
  }

  update(g: GuardState, dt: number, t: number, camPos?: THREE.Vector3, pose?: { x: number; y: number; z: number; visible: boolean } | null): void {
    this.root.position.set(g.x, g.y, GUARD_LANE_Z);
    if (pose) {
      this.root.position.set(pose.x, pose.y, pose.z);
      this.root.visible = pose.visible;
    } else this.root.visible = true;
    const camDist = camPos ? camPos.distanceTo(this.root.position) : 99;
    const coneFade = Math.min(1, Math.max(0, (camDist - 4) / 5));
    const chase = g.mode === 'chase';
    const speed = g.speed;
    const moveK = clamp(speed / 1.4, 0, 1);
    const yawTarget = g.facing > 0 ? 1.25 : -1.25;
    this.yawCur = damp(this.yawCur, yawTarget, chase ? 10 : 4, dt);
    this.yaw.rotation.y = this.yawCur;

    // Head looks where the eye-cone looks (lookDir), independent from the body.
    const lookWorld = g.lookDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    let headTarget = clamp(lookWorld - this.yawCur, -1.3, 1.3);
    if (g.mode === 'search' && g.searchPhase === 'look') headTarget += Math.sin(t * 1.4) * 0.25;
    this.headYaw = damp(this.headYaw, headTarget, 5, dt);
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = chase ? 0.0 : 0.12;

    const freq = chase ? 1.9 : 0.85 * (speed / 1.45);
    this.phase += dt * Math.PI * 2 * freq * (speed > 0.05 ? 1 : 0);
    const amp = (chase ? 0.75 : 0.36) * moveK;
    const sL = Math.sin(this.phase);
    const sR = -sL;
    this.legs[0].hip.rotation.x = -sL * amp;
    this.legs[1].hip.rotation.x = -sR * amp;
    this.legs[0].knee.rotation.x = 0.06 + Math.max(0, -Math.cos(this.phase)) * (chase ? 1.1 : 0.45) * moveK;
    this.legs[1].knee.rotation.x = 0.06 + Math.max(0, Math.cos(this.phase)) * (chase ? 1.1 : 0.45) * moveK;
    this.hips.position.y = 1.08 - (chase ? Math.abs(Math.cos(this.phase)) * 0.05 : 0);
    this.torso.rotation.x = chase ? 0.28 : 0.02;
    this.coat.rotation.x = -this.torso.rotation.x * 0.6 + Math.sin(this.phase * 2) * 0.03 * moveK - (chase ? 0.12 : 0);
    this.coat.rotation.z = Math.sin(this.phase) * 0.025 * moveK;
    // Patrol: hands clasped behind the back. Chase: arms pump.
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      if (chase) {
        this.arms[i].sh.rotation.x = (i === 0 ? sR : sL) * 0.9;
        this.arms[i].sh.rotation.z = side * 0.12;
        this.arms[i].el.rotation.x = -1.2;
      } else {
        this.arms[i].sh.rotation.x = damp(this.arms[i].sh.rotation.x, 0.42, 4, dt);
        this.arms[i].sh.rotation.z = side * 0.18;
        this.arms[i].el.rotation.x = damp(this.arms[i].el.rotation.x, -1.0, 4, dt);
      }
    }

    // Eye colour = state (diegetic stealth feedback).
    const target = EYE_COLORS[g.mode] ?? EYE_COLORS.patrol;
    this.eyeColor.lerp(target, 1 - Math.exp(-8 * dt));
    this.eyeMat.color.copy(this.eyeColor).multiplyScalar(4);
    this.lineMat.color.copy(this.eyeColor).multiplyScalar(2.2);
    this.eyeLight.color.copy(this.eyeColor).lerp(new THREE.Color(1, 1, 1), 0.35);
    this.eyeLight.intensity = 26 + (g.mode === 'chase' ? 14 : 0) + Math.sin(t * 40) * (g.mode === 'suspicious' ? 4 : 0);
    this.coneMat.uniforms.uColor.value.copy(this.eyeColor);
    this.coneMat.uniforms.uOpacity.value = (0.12 + g.suspicion * 0.12) * coneFade;
    this.head.updateMatrixWorld(true);
    this.eyeLight.getWorldPosition(this.eyeWorld);
  }

  setConeVisible(v: boolean): void {
    this.cone.visible = v;
  }
}
