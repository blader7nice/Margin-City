import * as THREE from 'three';

export type TexName =
  | 'marble_albedo'
  | 'marble_orm'
  | 'marble_normal'
  | 'wood_albedo'
  | 'wood_orm'
  | 'wood_normal'
  | 'stone_albedo'
  | 'stone_orm'
  | 'stone_normal'
  | 'frieze_albedo'
  | 'frieze_orm'
  | 'frieze_normal'
  | 'paper_atlas'
  | 'noise'
  | 'skyline';

const COLOR_TEX = new Set<TexName>(['marble_albedo', 'wood_albedo', 'stone_albedo', 'frieze_albedo', 'paper_atlas', 'skyline']);

export interface AssetStats {
  bytes: number;
  files: number;
  ms: number;
}

export class Assets {
  readonly tex = new Map<TexName, THREE.Texture>();
  stats: AssetStats = { bytes: 0, files: 0, ms: 0 };

  async load(names: TexName[], maxAniso: number, onProgress: (p: number) => void): Promise<void> {
    const t0 = performance.now();
    const loader = new THREE.ImageBitmapLoader();
    loader.setOptions({ imageOrientation: 'flipY' });
    let done = 0;
    await Promise.all(
      names.map(
        (n) =>
          new Promise<void>((resolve, reject) => {
            loader.load(
              `tex/${n}.webp`,
              (bmp) => {
                const t = new THREE.Texture(bmp as unknown as HTMLImageElement);
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.colorSpace = COLOR_TEX.has(n) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                t.anisotropy = maxAniso;
                t.flipY = false;
                t.needsUpdate = true;
                this.tex.set(n, t);
                done++;
                onProgress(done / names.length);
                resolve();
              },
              undefined,
              (e) => reject(e),
            );
          }),
      ),
    );
    this.stats.ms = performance.now() - t0;
    this.stats.files = names.length;
    for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      if (e.name.includes('/tex/')) this.stats.bytes += e.transferSize || e.encodedBodySize || 0;
    }
  }

  /** Get a texture clone with its own repeat settings. */
  get(name: TexName, repeatX = 1, repeatY = 1): THREE.Texture {
    const base = this.tex.get(name);
    if (!base) throw new Error(`texture ${name} not loaded`);
    if (repeatX === 1 && repeatY === 1) return base;
    const t = base.clone();
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
    return t;
  }
}

export const ALL_TEXTURES: TexName[] = [
  'marble_albedo',
  'marble_orm',
  'marble_normal',
  'wood_albedo',
  'wood_orm',
  'wood_normal',
  'stone_albedo',
  'stone_orm',
  'stone_normal',
  'frieze_albedo',
  'frieze_orm',
  'frieze_normal',
  'paper_atlas',
  'noise',
  'skyline',
];
