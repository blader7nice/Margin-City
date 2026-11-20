import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GuardState } from '../sim/types';
import { GUARD_LANE_Z } from '../sim/level';
import { EYE_COLORS } from './characters';
import { enhanceCharacterMaterials } from './fabric';
import { turnBoneWorldY } from './gltfCharacter';

/**
 * MM-01 from the Blender pipeline (tools/blender/make_mm01.py), driven by the guard simulation.
 * Same public surface as the procedural InspectorRig so the two are interchangeable (G key / ?mm=procedural).
 *
 * Contract with the art pipeline:
 *   clips:      Idle, Walk, Run, Consult (hand to the implant: "consulting MIRROR"), Grab
 *   materials:  mm_eye (state colour is driven here), cyber_red (fixed accents), fabric names (see fabric.ts)
 *   bones:      shared humanoid set + coat.L / coat.R / coat.B
 */
export const MM_CLIPS = ['Idle', 'Walk', 'Run', 'Consult', 'Grab'] as const;
type MMClip = (typeof MM_CLIPS)[number];
const NOMINAL = { Walk: 1.45, Run: 4.4 };

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = THREE.MathUtils.clamp;

export class GltfInspectorRig {
  readonly root = new THREE.Group();
  /** Model-aligned frame riding on the head bone (+Z = where MM-01 looks). Used by the camera director. */
  readonly head = new THREE.Object3D();
  readonly eyeLight: THREE.SpotLight;
  readonly eyeWorld = new THREE.Vector3();
  /** Set by the game when MM-01 has caught Leon. */
  grabbing = false;
  readonly stats: { triangles: number; clips: number; missing: string[]; fabric: string[] };
  private readonly yaw = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<MMClip, THREE.AnimationAction>();
  private current: MMClip = 'Idle';
  private readonly headBone: THREE.Object3D | null;
  private readonly neckBone: THREE.Object3D | null;
  private readonly rest: (readonly [THREE.Object3D, THREE.Quaternion])[];
  private readonly eyeMats: THREE.MeshStandardMaterial[] = [];
  private readonly cone: THREE.Mesh;
  private readonly coneMat: THREE.ShaderMaterial;
  private yawCur = -1.25;
  private headYaw = 0;
  private readonly eyeColor = new THREE.Color(0x63f3ff);

  constructor(gltf: GLTF, opts: { eyeShadow: boolean; fabric: boolean }) {
    const model = gltf.scene;
    this.root.add(this.yaw);
    this.yaw.add(model);
    let triangles = 0;
    let eyeCenter: THREE.Vector3 | null = null;
    let skinned: THREE.SkinnedMesh | null = null;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const g = m.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.envMapIntensity = 0.8;
      if (mat.name === 'mm_eye') {
        this.eyeMats.push(mat);
        g.computeBoundingBox();
        eyeCenter = g.boundingBox!.getCenter(new THREE.Vector3());
        skinned = m as THREE.SkinnedMesh;
      }
      // Silhouette readability in deep shadow (as on the procedural rig).
      if (mat.name === 'coat') mat.emissive = new THREE.Color(0x0a0e16);
    });
    const { enhanced } = enhanceCharacterMaterials(model, { enabled: opts.fabric });
    this.mixer = new THREE.AnimationMixer(model);
    const missing: string[] = [];
    for (const name of MM_CLIPS) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) {
        missing.push(name);
        continue;
      }
      const a = this.mixer.clipAction(clip);
      if (name === 'Grab') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(name, a);
    }
    this.actions.get('Idle')?.play();
    this.stats = { triangles, clips: this.actions.size, missing, fabric: enhanced };
    this.headBone = model.getObjectByName('head') ?? null;
    this.neckBone = model.getObjectByName('neck') ?? null;
    this.rest = [this.headBone, this.neckBone].filter((b): b is THREE.Object3D => !!b).map((b) => [b, b.quaternion.clone()] as const);

    // Head frame: bind-pose eye centre, axes aligned with the model (face = +Z), parented to the head bone.
    const sk = skinned as THREE.SkinnedMesh | null;
    const ec = eyeCenter as THREE.Vector3 | null;
    if (sk && ec && this.headBone) {
      const bi = sk.skeleton.bones.indexOf(this.headBone as THREE.Bone);
      const m = new THREE.Matrix4().copy(sk.skeleton.boneInverses[bi]).multiply(sk.bindMatrix).multiply(new THREE.Matrix4().makeTranslation(ec.x, ec.y, ec.z + 0.01));
      m.decompose(this.head.position, this.head.quaternion, this.head.scale);
      this.headBone.add(this.head);
    } else {
      this.head.position.set(-0.034, 1.85, 0.11);
      this.yaw.add(this.head);
    }

    this.eyeLight = new THREE.SpotLight(0x8ff6ff, 26, 16, 0.36, 0.55, 1.6);
    this.eyeLight.castShadow = opts.eyeShadow;
    this.eyeLight.shadow.mapSize.set(512, 512);
    this.eyeLight.shadow.bias = -0.0008;
    this.eyeLight.position.set(0, 0, 0.02);
    this.head.add(this.eyeLight);
    const tgt = new THREE.Object3D();
    tgt.position.set(0, -0.115, 2.0);
    this.head.add(tgt);
    this.eyeLight.target = tgt;

    // Small face fill so the half-human face reads in close shots (the eye spot points away from it).
    const faceFill = new THREE.PointLight(0xffd6b8, 1.6, 1.3, 2);
    faceFill.position.set(0.12, 0.06, 0.5);
    this.head.add(faceFill);
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
    this.cone.position.set(0, 0, 0.01);
    this.cone.rotation.x = 0.0575; // matches the procedural rig's slight downward gaze
    this.cone.renderOrder = 6;
    this.head.add(this.cone);
  }

  private play(name: MMClip, fade = 0.25): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (prev) next.crossFadeFrom(prev, fade, false);
    this.current = name;
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
    const yawTarget = g.facing > 0 ? 1.25 : -1.25;
    this.yawCur = damp(this.yawCur, yawTarget, chase ? 10 : 4, dt);
    this.yaw.rotation.y = this.yawCur;

    // ---- clip selection, driven only by the simulation
    let clip: MMClip = 'Idle';
    let rate = 1;
    if (this.grabbing) clip = 'Grab';
    else if (chase || g.speed > 2.2) {
      clip = 'Run';
      rate = clamp(g.speed / NOMINAL.Run, 0.6, 1.5);
    } else if (g.speed > 0.05) {
      clip = 'Walk';
      rate = clamp(g.speed / NOMINAL.Walk, 0.5, 1.6);
    } else if (g.mode === 'search' && g.searchPhase === 'forecast') clip = 'Consult';
    this.play(clip, clip === 'Grab' ? 0.12 : 0.3);
    const a = this.actions.get(this.current);
    if (a) a.timeScale = rate;
    for (const [b, q] of this.rest) b.quaternion.copy(q); // untracked bones must not accumulate the additive look
    this.mixer.update(dt);

    // ---- head looks where the vision cone looks (lookDir), split over neck and head
    const lookWorld = g.lookDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    let headTarget = clamp(lookWorld - this.yawCur, -1.3, 1.3);
    if (g.mode === 'search' && g.searchPhase === 'look') headTarget += Math.sin(t * 1.4) * 0.25;
    this.headYaw = damp(this.headYaw, headTarget, 5, dt);
    this.root.updateMatrixWorld(true);
    if (this.neckBone) {
      turnBoneWorldY(this.neckBone, this.headYaw * 0.35);
      this.neckBone.updateMatrixWorld(true);
    }
    if (this.headBone) turnBoneWorldY(this.headBone, this.headYaw * (this.neckBone ? 0.65 : 1));

    // ---- eye colour = state (diegetic stealth feedback); red accents stay red
    const target = EYE_COLORS[g.mode] ?? EYE_COLORS.patrol;
    this.eyeColor.lerp(target, 1 - Math.exp(-8 * dt));
    for (const m of this.eyeMats) {
      m.color.setRGB(0, 0, 0);
      m.emissive.copy(this.eyeColor);
      m.emissiveIntensity = 6;
    }
    this.eyeLight.color.copy(this.eyeColor).lerp(new THREE.Color(1, 1, 1), 0.35);
    this.eyeLight.intensity = 26 + (chase ? 14 : 0) + Math.sin(t * 40) * (g.mode === 'suspicious' ? 4 : 0);
    this.coneMat.uniforms.uColor.value.copy(this.eyeColor);
    this.coneMat.uniforms.uOpacity.value = (0.12 + g.suspicion * 0.12) * coneFade;
    this.root.updateMatrixWorld(true);
    this.eyeLight.getWorldPosition(this.eyeWorld);
  }

  setConeVisible(v: boolean): void {
    this.cone.visible = v;
  }
}
