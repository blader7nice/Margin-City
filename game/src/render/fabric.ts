import * as THREE from 'three';

/**
 * Character material enhancer for the Blender → glTF pipeline.
 *
 * Blender exports flat-colour PBR materials with a baked ambient-occlusion vertex colour (COLOR_0).
 * Here we add cheap, texture-free surface detail per material *name* (the naming contract shared by all
 * characters: knit, canvas, wool, leather, coat, ...):
 *   - a procedural height pattern evaluated in the mesh's REST space (so the pattern sticks to the cloth
 *     while the skeleton animates — no swimming),
 *   - derivative-based bump (no tangents, no UVs, no textures to download),
 *   - small roughness/colour variation.
 * Cost: a few ALU ops per fragment on character pixels only. Disabled on the 'low' quality preset.
 */

export type FabricKind = 'knit' | 'canvas' | 'wool' | 'leather' | 'coat' | 'skin' | 'hair';

interface FabricSpec {
  kind: number;
  scale: number;
  bump: number;
  /** Multiplies baked AO contrast (1 = as baked). */
  ao: number;
}

const SPECS: Record<string, FabricSpec> = {
  knit: { kind: 1, scale: 1, bump: 0.9, ao: 1 },
  canvas: { kind: 2, scale: 1, bump: 0.35, ao: 1 },
  canvas_dark: { kind: 2, scale: 1, bump: 0.35, ao: 1 },
  hood: { kind: 3, scale: 1.2, bump: 0.35, ao: 1 },
  wool: { kind: 3, scale: 1, bump: 0.4, ao: 1 },
  sock: { kind: 1, scale: 1.6, bump: 0.5, ao: 1 },
  leather: { kind: 4, scale: 1, bump: 0.25, ao: 1 },
  bag: { kind: 4, scale: 1, bump: 0.3, ao: 1 },
  coat: { kind: 3, scale: 0.8, bump: 0.3, ao: 1 },
  coat_lining: { kind: 5, scale: 1, bump: 0.2, ao: 1 },
  hair: { kind: 6, scale: 1, bump: 0.5, ao: 1 },
  skin: { kind: 7, scale: 1, bump: 0.06, ao: 1 },
};

const VERT_DECL = /* glsl */ `
varying vec3 vRestPos;
varying vec3 vRestNormal;
`;

const FRAG_DECL = /* glsl */ `
varying vec3 vRestPos;
varying vec3 vRestNormal;
uniform float uFabricKind;
uniform float uFabricScale;
uniform float uFabricBump;
float fHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i + vec3(0,0,0)), fHash(i + vec3(1,0,0)), f.x), mix(fHash(i + vec3(0,1,0)), fHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0,0,1)), fHash(i + vec3(1,0,1)), f.x), mix(fHash(i + vec3(0,1,1)), fHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// Band weight: fades out pattern frequencies that would alias at the current pixel footprint (lod = metres/pixel).
float bw(float f, float lod) { return clamp(1.5 - lod * f * 0.5, 0.0, 1.0); }
// Height field in rest space (metres). Blender Z-up becomes glTF Y-up: rest Y is "up the body".
float fabricHeight(vec3 p, vec3 n, float lod) {
  float k = uFabricKind;
  float s = uFabricScale;
  vec3 q = p * s;
  // Horizontal coordinate around the body (works for torso and limbs alike).
  float around = abs(n.x) > abs(n.z) ? q.z : q.x;
  if (k < 1.5) {
    // knit: vertical ribs + cable braids + stitch rows
    float rib = (0.5 + 0.5 * sin(around * 260.0)) * bw(260.0 * s, lod);
    float cable = smoothstep(0.2, 0.9, sin(around * 55.0 + sin(q.y * 70.0) * 1.6)) * bw(70.0 * s, lod);
    float rows = (0.5 + 0.5 * sin(q.y * 420.0 + around * 30.0)) * bw(420.0 * s, lod);
    return rib * 0.45 + cable * 0.8 + rows * 0.15;
  } else if (k < 2.5) {
    // canvas: fine plain weave + soft creases
    float w = sin(q.y * 900.0) * sin(around * 900.0) * bw(900.0 * s, lod);
    return w * 0.15 + fNoise(q * vec3(6.0, 18.0, 6.0)) * 0.9;
  } else if (k < 3.5) {
    // wool / brushed: fuzzy noise, gentle vertical drape
    return fNoise(q * 140.0) * 0.35 * bw(140.0 * s, lod) + fNoise(q * vec3(8.0, 2.5, 8.0)) * 0.9;
  } else if (k < 4.5) {
    // leather: pebbled grain + scuffs
    return fNoise(q * 260.0) * 0.4 * bw(260.0 * s, lod) + fNoise(q * 25.0) * 0.6;
  } else if (k < 5.5) {
    // patterned lining: diagonal jacquard
    return (0.5 + 0.5 * sin((q.x + q.y + q.z) * 160.0)) * bw(160.0 * s, lod);
  } else if (k < 6.5) {
    // hair: strands (approximated)
    return fNoise(q * vec3(90.0, 260.0, 90.0)) * 0.7 * bw(260.0 * s, lod) + fNoise(q * 30.0) * 0.5;
  }
  // skin: pores (very subtle, close-ups only)
  return fNoise(q * 900.0) * bw(900.0 * s, lod);
}
vec3 fabricPerturb(vec3 surfPos, vec3 surfNorm, float h, float strength) {
  vec3 vSigmaX = dFdx(surfPos);
  vec3 vSigmaY = dFdy(surfPos);
  vec3 R1 = cross(vSigmaY, surfNorm);
  vec3 R2 = cross(surfNorm, vSigmaX);
  float fDet = dot(vSigmaX, R1);
  vec2 dHdxy = vec2(dFdx(h), dFdy(h)) * strength;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surfNorm - vGrad);
}
`;

export interface FabricOptions {
  enabled: boolean;
  /** Overall bump scale (quality presets / distance). */
  strength?: number;
}

/** Applies baked-AO vertex colours and procedural fabric detail to every named character material under `root`. */
export function enhanceCharacterMaterials(root: THREE.Object3D, opts: FabricOptions): { enhanced: string[] } {
  const enhanced: string[] = [];
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hasAO = !!mesh.geometry.getAttribute('color');
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (done.has(mat)) continue;
      done.add(mat);
      if (hasAO) mat.vertexColors = true;
      const spec = SPECS[mat.name] ?? SPECS[mat.name.replace(/\.\d+$/, '')];
      if (!spec || !opts.enabled) continue;
      const strength = (opts.strength ?? 1) * spec.bump;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uFabricKind = { value: spec.kind };
        shader.uniforms.uFabricScale = { value: spec.scale };
        shader.uniforms.uFabricBump = { value: strength };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestPos = position;\nvRestNormal = normal;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
          .replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
            {
              float fLod = length(fwidth(vRestPos));
              float fh = fabricHeight(vRestPos, normalize(vRestNormal), fLod);
              normal = fabricPerturb(-vViewPosition, normal, fh * 0.0025, uFabricBump);
            }`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            roughnessFactor = clamp(roughnessFactor + (fNoise(vRestPos * 40.0) - 0.5) * 0.12, 0.04, 1.0);`,
          );
      };
      mat.customProgramCacheKey = () => `fabric-${spec.kind}-${strength.toFixed(2)}`;
      mat.needsUpdate = true;
      enhanced.push(mat.name);
    }
  });
  return { enhanced };
}
