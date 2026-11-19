import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { Quality } from './quality';

export class Post {
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly dof: DepthOfFieldEffect | null;
  readonly vignette: VignetteEffect;
  readonly grade: HueSaturationEffect;
  private readonly bc: BrightnessContrastEffect;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: Quality) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    if (q.dof) {
      this.dof = new DepthOfFieldEffect(camera, { focusDistance: 17, focusRange: 9, bokehScale: 2.2, resolutionScale: 0.5 });
      this.composer.addPass(new EffectPass(camera, this.dof));
    } else this.dof = null;
    const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.75, luminanceSmoothing: 0.25, intensity: 1.15, radius: 0.72 });
    this.vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.09;
    this.grade = new HueSaturationEffect({ saturation: -0.06, hue: 0 });
    this.bc = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.13 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const effects = q.bloom ? [bloom, this.vignette, this.grade, this.bc, tone, noise] : [this.vignette, this.grade, this.bc, tone, noise];
    this.composer.addPass(new EffectPass(camera, ...effects));
    this.composer.addPass(new EffectPass(camera, new SMAAEffect()));
  }

  setFocus(distance: number): void {
    if (this.dof) this.dof.cocMaterial.focusDistance = distance;
  }

  /** Stealth feedback without HUD: saturation drops and vignette tightens with suspicion. */
  setTension(suspicion: number, caught: number): void {
    this.vignette.darkness = 0.62 + suspicion * 0.25 + caught * 0.3;
    this.grade.saturation = -0.06 - suspicion * 0.18 - caught * 0.5;
    this.bc.brightness = -caught * 0.25;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
