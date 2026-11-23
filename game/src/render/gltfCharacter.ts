import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { enhanceCharacterMaterials } from './fabric';
import type { LeonState } from '../sim/types';
import { HIDE_SPOTS, LEON_LANE_Z } from '../sim/level';

/**
 * Production character pipeline: a skinned glTF/GLB (made in Blender) driven by an animation state machine.
 * Clip names are the contract between the art pipeline and the game:
 *   Idle, Walk, Run, CrouchIdle, CrouchWalk, Push, JumpUp, Fall, Slide, Mantle, Hide, Caught
 * Any artist-made Leon (or a commissioned model) that ships these clips drops in without code changes.
 */

export const LEON_CLIPS = ['Idle', 'Walk', 'Run', 'CrouchIdle', 'CrouchWalk', 'Push', 'JumpUp', 'Fall', 'Slide', 'Mantle', 'Hide', 'Caught'] as const;
/** Optional flavour clips: used when present, never required. */
export const LEON_OPTIONAL_CLIPS = ['IdleCompass'] as const;
export type LeonClip = (typeof LEON_CLIPS)[number] | (typeof LEON_OPTIONAL_CLIPS)[number];
/** Seconds of standing still before Leon checks Dave's compass. */
const COMPASS_AFTER = 3.5;

/** Nominal speeds the cycles were authored for (m/s) → playback rate follows the simulation. */
const NOMINAL: Partial<Record<LeonClip, number>> = { Walk: 2.6, Run: 5.4, CrouchWalk: 1.4, Push: 1.4 };

export async function loadGLB(url: string): Promise<GLTF> {
  try {
    return await loadOne(url);
  } catch (e) {
    // Hosts that do not serve .glb get a JSON glTF with the (meshopt) buffer embedded: same data, same loader.
    const alt = url.replace(/\.glb$/, '.gltf.json');
    if (alt === url) throw e;
    return loadOne(alt);
  }
}

async function loadOne(url: string): Promise<GLTF> {
  // Meshopt-compressed + quantized GLB (gltf-transform optimize): ~2.4x smaller than the raw Blender export.
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
}

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Additive yaw about the WORLD up axis for a bone with rotated parents (rotateOnWorldAxis assumes an unrotated parent). */
export function turnBoneWorldY(bone: THREE.Object3D, angle: number): void {
  if (!angle) return;
  const pq = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(pq);
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(pq.invert());
  bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}


export class GltfLeonRig {
  readonly root = new THREE.Group();
  private readonly yaw = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<LeonClip, THREE.AnimationAction>();
  private current: LeonClip = 'Idle';
  private idleT = 0;
  private readonly headRest: THREE.Quaternion | null;
  private readonly head: THREE.Object3D | null;
  private readonly fill: THREE.PointLight;
  private readonly rim: THREE.PointLight;
  private yawCur = 1.12;
  private z = LEON_LANE_Z;
  private lookYaw = 0;
  readonly missingClips: string[] = [];
  readonly stats: { triangles: number; bones: number; clips: number; fabric: string[] };

  constructor(gltf: GLTF, opts: { fabric: boolean } = { fabric: true }) {
    const model = gltf.scene;
    this.root.add(this.yaw);
    this.yaw.add(model);
    let triangles = 0;
    let bones = 0;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // skinned bounds are unreliable when animated
        const g = m.geometry;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) (mat as THREE.MeshStandardMaterial).envMapIntensity = 0.6;
      }
      if ((o as THREE.Bone).isBone) bones++;
    });
    this.mixer = new THREE.AnimationMixer(model);
    for (const name of [...LEON_CLIPS, ...LEON_OPTIONAL_CLIPS] as LeonClip[]) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) {
        if ((LEON_CLIPS as readonly string[]).includes(name)) this.missingClips.push(name);
        continue;
      }
      const a = this.mixer.clipAction(clip);
      if (name === 'Mantle' || name === 'JumpUp' || name === 'Slide') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(name, a);
    }
    this.actions.get('Idle')?.play();
    const { enhanced } = enhanceCharacterMaterials(model, { enabled: opts.fabric });
    this.stats = { triangles, bones, clips: this.actions.size, fabric: enhanced };
    this.head = model.getObjectByName('head') ?? null;
    this.headRest = this.head ? this.head.quaternion.clone() : null;
    this.rim = new THREE.PointLight(0xa8c0ff, 7, 3.2, 2);
    this.rim.position.set(0, 2.1, -1.1);
    this.fill = new THREE.PointLight(0xffc89a, 2.6, 3.2, 2);
    this.fill.position.set(0, 1.4, 1.6);
    this.root.add(this.rim, this.fill);
  }

  snap(): void {
    this.idleT = 0;
  }

  private play(name: LeonClip, fade = 0.18): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    const prev = this.actions.get(this.current);
    if (!next) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (prev) next.crossFadeFrom(prev, fade, false);
    this.current = name;
  }

  update(l: LeonState, dt: number, t: number, threat: { x: number; y: number; active: boolean } | null): void {
    const speed = Math.abs(l.vx);
    const hiddenSpot = l.hideId ? HIDE_SPOTS.find((h) => h.id === l.hideId) : undefined;
    let targetZ = LEON_LANE_Z;
    if ((l.mode === 'enterHide' || l.mode === 'hidden') && hiddenSpot) targetZ = hiddenSpot.depthZ;
    this.z = damp(this.z, targetZ, 10, dt);
    this.root.position.set(l.x, l.y, this.z);

    let yawTarget = l.facing > 0 ? 1.12 : -1.12;
    if (l.mode === 'mantle') yawTarget = l.facing > 0 ? 1.45 : -1.45;
    if (l.mode === 'hidden' || l.mode === 'enterHide') yawTarget = 0;
    if (l.mode === 'finished') yawTarget = l.facing > 0 ? 1.4 : -1.4;
    this.yawCur = damp(this.yawCur, yawTarget, 12, dt);
    this.yaw.rotation.y = this.yawCur;

    // ---- animation state machine (driven only by simulation state) ----
    let clip: LeonClip = 'Idle';
    let rate = 1;
    if (l.mode === 'caught') clip = 'Caught';
    else if (l.mode === 'hidden' || l.mode === 'enterHide') clip = 'Hide';
    else if (l.mode === 'mantle') {
      clip = 'Mantle';
      rate = 0.467 / 0.44;
    } else if (l.slideT > 0) clip = 'Slide';
    else if (l.pushing) {
      clip = 'Push';
      rate = Math.max(0.4, speed / NOMINAL.Push!);
    } else if (!l.grounded && l.mode === 'normal') clip = l.vy > 0 ? 'JumpUp' : 'Fall';
    else if (l.crouching) {
      clip = speed > 0.2 ? 'CrouchWalk' : 'CrouchIdle';
      if (clip === 'CrouchWalk') rate = speed / NOMINAL.CrouchWalk!;
    } else if (speed > 3.7) {
      clip = 'Run';
      rate = speed / NOMINAL.Run!;
    } else if (speed > 0.15) {
      clip = 'Walk';
      rate = Math.max(0.5, speed / NOMINAL.Walk!);
    }
    // Quiet moment: Leon looks at Dave's compass (only when nothing threatens him).
    this.idleT = clip === 'Idle' && l.mode === 'normal' && !(threat && threat.active) ? this.idleT + dt : 0;
    if (this.idleT > COMPASS_AFTER && this.actions.has('IdleCompass')) clip = 'IdleCompass';
    this.play(clip, clip === 'Mantle' || clip === 'Slide' ? 0.08 : clip === 'IdleCompass' || this.current === 'IdleCompass' ? 0.45 : 0.18);
    const a = this.actions.get(this.current);
    if (a) a.timeScale = rate;
    // Bones without an animation track keep last frame's pose: reset before the mixer so additive look never accumulates.
    if (this.head && this.headRest) this.head.quaternion.copy(this.headRest);
    this.mixer.update(dt);

    // Readability fill, as on the procedural rig.
    // M04: stronger lift in dark areas — Leon must stay readable as a silhouette AND show his face/coat colour.
    const dark = 1 - Math.min(1, l.light * 1.4);
    this.fill.intensity = 2.2 + dark * 4.6;
    this.rim.intensity = 6.5 + dark * 7.5;

    // Additive head look toward MM-01 on top of the clip.
    let lookTarget = 0;
    if (threat && threat.active && l.mode !== 'caught') lookTarget = THREE.MathUtils.clamp(Math.atan2(threat.x - l.x, 2.5) - this.yawCur, -0.9, 0.9);
    this.lookYaw = damp(this.lookYaw, lookTarget, 6, dt);
    if (this.head) {
      this.root.updateMatrixWorld(true);
      turnBoneWorldY(this.head, this.lookYaw);
    }
  }
}
