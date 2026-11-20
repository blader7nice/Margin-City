import * as THREE from 'three';
import { CAMERA_SHOTS, MEZZ_SHOT, MEZZ_Y, type CameraShot } from '../sim/level';

/** Inside the service duct: low, close, the cut-away section of the floor fills the frame. */
const DUCT_SHOT: CameraShot = { id: 'duct', x0: 0, x1: 0, offset: [0, 0.85, 8.5], fov: 40, look: [2.2, 0.6, 0], threatFraming: 0 };
import type { GuardState, LeonState } from '../sim/types';

/**
 * Cinematic 2.5D camera director.
 * Rules: gameplay always wins — left/right on screen always maps to -x/+x (yaw never exceeds ~25°),
 * transitions are blended (no hard cuts during control), MM-01 is pulled into frame when he matters.
 */

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

interface Cinematic {
  kind: 'intro' | 'reveal' | 'caught' | 'finale';
  t: number;
  dur: number;
}

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;
  private offset = new THREE.Vector3(4.5, 2.6, 15.5);
  private look = new THREE.Vector3(1.8, 0.4, 0);
  private fov = 36;
  private focus = new THREE.Vector3();
  private focusY = 0;
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private threatMix = 0;
  private threatDy = 0;
  private cine: Cinematic | null = null;
  private shake = 0;
  shotId = 'entrance';
  letterbox = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 400);
  }

  startIntro(): void {
    this.cine = { kind: 'intro', t: 0, dur: 5.5 };
  }
  startReveal(): void {
    this.cine = { kind: 'reveal', t: 0, dur: 3.4 };
  }
  startCaught(): void {
    this.cine = { kind: 'caught', t: 0, dur: 1.6 };
  }
  startFinale(): void {
    this.cine = { kind: 'finale', t: 0, dur: 99 };
  }
  skipCinematic(): void {
    if (this.cine && (this.cine.kind === 'intro' || this.cine.kind === 'reveal')) this.cine.t = Math.max(this.cine.t, this.cine.dur - 0.6);
  }
  get inCinematic(): boolean {
    return this.cine !== null && this.cine.kind !== 'caught';
  }
  addShake(v: number): void {
    this.shake = Math.min(1, this.shake + v);
  }

  snap(leon: LeonState): void {
    const shot = this.pickShot(leon);
    this.offset.set(...shot.offset);
    this.look.set(...shot.look);
    this.fov = shot.fov;
    this.focus.set(leon.x, leon.y, 0);
    this.focusY = leon.y;
    this.pos.copy(this.focus).add(this.offset);
    this.target.copy(this.focus).add(this.look);
  }

  private pickShot(l: LeonState): CameraShot {
    if (l.y < -0.5) return DUCT_SHOT;
    if (l.y > MEZZ_Y - 0.6 && l.x > MEZZ_SHOT.x0 && l.x < MEZZ_SHOT.x1) return MEZZ_SHOT;
    return CAMERA_SHOTS.find((s) => l.x >= s.x0 && l.x < s.x1) ?? CAMERA_SHOTS[CAMERA_SHOTS.length - 1];
  }

  update(dt: number, t: number, leon: LeonState, guard: GuardState, guardHead: THREE.Vector3, guardFwd: THREE.Vector3, aspect: number): void {
    const shot = this.pickShot(leon);
    this.shotId = shot.id;
    const k = 2.2;
    this.offset.x = damp(this.offset.x, shot.offset[0], k, dt);
    this.offset.y = damp(this.offset.y, shot.offset[1], k, dt);
    this.offset.z = damp(this.offset.z, shot.offset[2], k, dt);
    this.look.x = damp(this.look.x, shot.look[0] * leonFacingSign(leon), k, dt);
    this.look.y = damp(this.look.y, shot.look[1], k, dt);
    this.fov = damp(this.fov, shot.fov, k, dt);

    // Platformer-style vertical framing: follow the ground height, not every jump.
    const groundY = leon.grounded || leon.mode !== 'normal' ? leon.y : Math.min(this.focusY, leon.y);
    this.focusY = damp(this.focusY, groundY, leon.grounded ? 3.5 : 1.2, dt);
    if (leon.y < this.focusY - 1.5) this.focusY = damp(this.focusY, leon.y, 6, dt);

    // Threat framing: blend focus toward MM-01 when he is close and alert.
    const dx = guard.x - leon.x;
    const alert = guard.mode !== 'patrol' ? 1 : 0.45;
    const want = Math.abs(dx) < 14 ? shot.threatFraming * alert : 0;
    this.threatMix = damp(this.threatMix, want, 1.5, dt);
    const lead = Math.max(-1.6, Math.min(1.6, leon.vx * 0.3));
    let fx = leon.x + lead + dx * 0.5 * this.threatMix;
    // Room framing (puzzle diorama): pull the focus toward the room centre.
    if (shot.lockX !== undefined) fx += (shot.lockX - fx) * (shot.lockWeight ?? 0.5);
    this.focus.x = damp(this.focus.x, fx, 3.0, dt);
    // Vertical threat framing (M03 readability): when MM-01 hunts on another lane (floor vs catwalk),
    // drift the frame toward him so the threat never sits on the frame edge.
    const dy = guard.y - leon.y;
    this.threatDy = damp(this.threatDy, Math.abs(dy) > 1 ? dy * 0.5 * this.threatMix : 0, 2.0, dt);
    this.focus.y = this.focusY + this.threatDy;
    this.focus.z = 0;

    const desiredPos = this.focus.clone().add(this.offset);
    const desiredTarget = this.focus.clone().add(this.look);
    // widen a little when framing the threat
    let fov = this.fov + this.threatMix * 4;
    this.letterbox = damp(this.letterbox, 0, 3, dt);

    if (this.cine) {
      const c = this.cine;
      c.t += dt;
      const u = Math.min(1, c.t / c.dur);
      const ease = (x: number) => x * x * (3 - 2 * x);
      if (c.kind === 'intro') {
        // Crane from a wide, monumental establishing shot down to Leon on the catwalk.
        const wide = new THREE.Vector3(-6, 15, 44);
        const wideT = new THREE.Vector3(-4, 10, -14);
        const e = ease(Math.min(1, Math.max(0, (u - 0.15) / 0.85)));
        desiredPos.lerpVectors(wide, desiredPos, e);
        desiredTarget.lerpVectors(wideT, desiredTarget, e);
        fov = THREE.MathUtils.lerp(42, fov, e);
        this.letterbox = 1 - e;
      } else if (c.kind === 'reveal') {
        // Slow push to MM-01's half-human face, then back to gameplay.
        const face = guardHead.clone();
        // 3/4 front view of the face so both halves (human + implants) read.
        const fwd = guardFwd.clone().setY(0).normalize();
        // Stay in the free gameplay lane (z ≈ +1) so no prop can block the shot.
        const close = face.clone().addScaledVector(fwd, 2.1).add(new THREE.Vector3(0, 0.05, 0.65));
        const closeT = face.clone().add(new THREE.Vector3(0, 0.02, 0));
        const inE = ease(Math.min(1, c.t / 0.9));
        const outE = ease(Math.max(0, (c.t - (c.dur - 0.8)) / 0.8));
        const push = Math.min(1, c.t / c.dur) * 0.35;
        close.add(new THREE.Vector3(0, 0, -push));
        const p = new THREE.Vector3().lerpVectors(desiredPos, close, inE * (1 - outE));
        const tt = new THREE.Vector3().lerpVectors(desiredTarget, closeT, inE * (1 - outE));
        desiredPos.copy(p);
        desiredTarget.copy(tt);
        fov = THREE.MathUtils.lerp(fov, 30, inE * (1 - outE));
        this.letterbox = inE * (1 - outE);
        if (c.t >= c.dur) this.cine = null;
      } else if (c.kind === 'caught') {
        const leonP = new THREE.Vector3(leon.x, leon.y + 1.0, 0);
        const p = leonP.clone().add(new THREE.Vector3(0.8, 0.5, 5.5));
        const e = ease(Math.min(1, c.t / 0.6));
        desiredPos.lerp(p, e);
        desiredTarget.lerp(leonP, e);
        fov = THREE.MathUtils.lerp(fov, 30, e);
        if (c.t >= c.dur) this.cine = null;
      } else if (c.kind === 'finale') {
        // Inside the terminal room, looking back at the glass door: MM-01 stares through it.
        const door = new THREE.Vector3(91.7, 1.75, -0.6);
        const p = new THREE.Vector3(96.4 - Math.min(c.t, 6) * 0.12, 1.85, 4.2);
        const e = ease(Math.min(1, c.t / 1.6));
        desiredPos.lerp(p, e);
        desiredTarget.lerp(door, e);
        fov = THREE.MathUtils.lerp(fov, 34, e);
        this.letterbox = e;
      }
      if (c.kind === 'intro' && c.t >= c.dur) this.cine = null;
      this.pos.lerp(desiredPos, c.kind === 'intro' || c.kind === 'reveal' ? 1 : 1 - Math.exp(-6 * dt));
      this.target.lerp(desiredTarget, c.kind === 'intro' || c.kind === 'reveal' ? 1 : 1 - Math.exp(-6 * dt));
    } else {
      this.pos.lerp(desiredPos, 1 - Math.exp(-5 * dt));
      this.target.lerp(desiredTarget, 1 - Math.exp(-5 * dt));
    }

    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.12;
    this.camera.position.set(this.pos.x + Math.sin(t * 37) * sh, this.pos.y + Math.sin(t * 43 + 1) * sh, this.pos.z);
    this.camera.lookAt(this.target);
    // Gentle handheld breathing keeps the frame alive.
    this.camera.rotation.z += Math.sin(t * 0.37) * 0.0015;
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

function leonFacingSign(l: LeonState): number {
  return l.facing;
}
