import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Scarf } from './characters';
import type { LeonState } from '../sim/types';
import { HIDE_SPOTS, LEON_LANE_Z } from '../sim/level';

/**
 * Production character pipeline: a skinned glTF/GLB (made in Blender) driven by an animation state machine.
 * Clip names are the contract between the art pipeline and the game:
 *   Idle, Walk, Run, CrouchIdle, CrouchWalk, Push, JumpUp, Fall, Slide, Mantle, Hide, Caught
 * Any artist-made Leon (or a commissioned model) that ships these clips drops in without code changes.
 */

export const LEON_CLIPS = ['Idle', 'Walk', 'Run', 'CrouchIdle', 'CrouchWalk', 'Push', 'JumpUp', 'Fall', 'Slide', 'Mantle', 'Hide', 'Caught'] as const;
export type LeonClip = (typeof LEON_CLIPS)[number];

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

export class GltfLeonRig {
  readonly root = new THREE.Group();
  private readonly yaw = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<LeonClip, THREE.AnimationAction>();
  private current: LeonClip = 'Idle';
  private readonly scarf: Scarf;
  private readonly neck: THREE.Object3D | null;
  private readonly head: THREE.Object3D | null;
  private readonly fill: THREE.PointLight;
  private readonly rim: THREE.PointLight;
  private yawCur = 1.12;
  private z = LEON_LANE_Z;
  private lookYaw = 0;
  private first = true;
  readonly missingClips: string[] = [];
  readonly stats: { triangles: number; bones: number; clips: number };

  constructor(gltf: GLTF) {
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
    for (const name of LEON_CLIPS) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) {
        this.missingClips.push(name);
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
    this.stats = { triangles, bones, clips: this.actions.size };
    this.neck = model.getObjectByName('neck') ?? null;
    this.head = model.getObjectByName('head') ?? null;
    this.scarf = new Scarf(new THREE.MeshStandardMaterial({ color: 0xc9802f, roughness: 0.92, side: THREE.DoubleSide }));
    this.rim = new THREE.PointLight(0xa8c0ff, 7, 3.2, 2);
    this.rim.position.set(0, 2.1, -1.1);
    this.fill = new THREE.PointLight(0xffc89a, 2.6, 3.2, 2);
    this.fill.position.set(0, 1.4, 1.6);
    this.root.add(this.rim, this.fill);
  }

  get scarfMesh(): THREE.Mesh {
    return this.scarf.mesh;
  }

  snap(): void {
    this.first = true;
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
    this.play(clip, clip === 'Mantle' || clip === 'Slide' ? 0.08 : 0.18);
    const a = this.actions.get(this.current);
    if (a) a.timeScale = rate;
    this.mixer.update(dt);

    // Readability fill, as on the procedural rig.
    const dark = 1 - Math.min(1, l.light * 1.4);
    this.fill.intensity = 2.0 + dark * 3.2;
    this.rim.intensity = 6 + dark * 4;

    // Additive head look toward MM-01 on top of the clip.
    let lookTarget = 0;
    if (threat && threat.active && l.mode !== 'caught') lookTarget = THREE.MathUtils.clamp(Math.atan2(threat.x - l.x, 2.5) - this.yawCur, -0.9, 0.9);
    this.lookYaw = damp(this.lookYaw, lookTarget, 6, dt);
    if (this.head) this.head.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), this.lookYaw);

    // Procedural scarf tail anchored to the neck bone (secondary motion on top of skeletal animation).
    this.root.updateMatrixWorld(true);
    const anchor = new THREE.Vector3();
    if (this.neck) this.neck.getWorldPosition(anchor);
    else anchor.set(l.x, l.y + 1.45, this.z);
    anchor.y -= 0.02;
    anchor.addScaledVector(new THREE.Vector3(-Math.sin(this.yawCur), 0, -Math.cos(this.yawCur)), 0.07);
    if (this.first) {
      this.scarf.reset(anchor);
      this.first = false;
    }
    this.scarf.update(anchor, Math.min(dt, 1 / 30), t, -l.vx * 3 - 0.6);
  }
}
