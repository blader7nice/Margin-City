import * as THREE from 'three';

/**
 * Light pooling: the level declares any number of practical lights as "anchors"; a fixed pool of K real
 * PointLights is assigned each frame to the anchors nearest the action. Shader cost stays constant
 * (no recompiles, no per-light cost growth as levels get bigger) — important for weak GPUs and phones.
 */
export interface LightAnchor {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
  decay: number;
  /** 0..1 flicker strength (broken lamps). */
  flicker?: number;
  /** Dynamic intensity multiplier (e.g. alarm pulse). */
  scale?: (t: number) => number;
}

export interface LightAnchorInit {
  position: [number, number, number] | THREE.Vector3;
  color: THREE.ColorRepresentation;
  intensity: number;
  distance: number;
  decay: number;
  flicker?: number;
  scale?: (t: number) => number;
}

export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  readonly anchors: LightAnchor[] = [];
  private readonly far = 30;

  constructor(parent: THREE.Object3D, size: number) {
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      parent.add(l);
      this.lights.push(l);
    }
  }

  add(a: LightAnchorInit): LightAnchor {
    const anchor: LightAnchor = {
      intensity: a.intensity,
      distance: a.distance,
      decay: a.decay,
      flicker: a.flicker,
      scale: a.scale,
      position: Array.isArray(a.position) ? new THREE.Vector3(a.position[0], a.position[1], a.position[2]) : a.position.clone(),
      color: new THREE.Color(a.color),
    };
    this.anchors.push(anchor);
    return anchor;
  }

  update(focus: THREE.Vector3, t: number): void {
    const scored = this.anchors
      .map((a) => ({ a, d: a.position.distanceTo(focus) - Math.sqrt(a.intensity) * 0.6 }))
      .sort((p, q) => p.d - q.d);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const s = scored[i];
      if (!s) {
        l.intensity = 0;
        continue;
      }
      const a = s.a;
      const dist = a.position.distanceTo(focus);
      // Fade out toward the pool edge so re-assignment never pops in the middle of the frame.
      const fade = 1 - THREE.MathUtils.smoothstep(dist, this.far * 0.6, this.far);
      let k = fade * (a.scale ? a.scale(t) : 1);
      if (a.flicker) {
        const n = Math.sin(t * 23.0 + i) * Math.sin(t * 7.3) * Math.sin(t * 1.3);
        if (n > 0.55) k *= 1 - a.flicker * 0.75;
      }
      l.position.copy(a.position);
      l.color.copy(a.color);
      l.distance = a.distance;
      l.decay = a.decay;
      l.intensity = a.intensity * k;
    }
  }
}
