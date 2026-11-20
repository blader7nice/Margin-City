import * as THREE from 'three';

/**
 * Keeps Leon readable: big architecture between the camera and Leon fades to a ghost instead of hiding him.
 * Raycasts from the camera to a few points on Leon; any registered object hit fades out smoothly.
 */
export class OcclusionFader {
  private readonly items = new Map<THREE.Object3D, { mats: THREE.Material[]; cur: number; target: number }>();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly ray = new THREE.Raycaster();

  register(root: THREE.Object3D): void {
    const mats: THREE.Material[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const own = (Array.isArray(m.material) ? m.material : [m.material]).map((mm) => {
        const c = mm.clone();
        c.userData.baseOpacity = c.opacity;
        c.userData.baseTransparent = c.transparent;
        return c;
      });
      m.material = Array.isArray(m.material) ? own : own[0];
      mats.push(...own);
      m.userData.fadeRoot = root;
      this.meshes.push(m);
    });
    this.items.set(root, { mats, cur: 1, target: 1 });
  }

  update(camera: THREE.Camera, targets: THREE.Vector3[], dt: number): void {
    for (const it of this.items.values()) it.target = 1;
    const origin = camera.getWorldPosition(new THREE.Vector3());
    for (const t of targets) {
      const dir = t.clone().sub(origin);
      const far = dir.length() - 0.3;
      this.ray.set(origin, dir.normalize());
      this.ray.far = far;
      for (const hit of this.ray.intersectObjects(this.meshes, false)) {
        const root = hit.object.userData.fadeRoot as THREE.Object3D | undefined;
        if (root) this.items.get(root)!.target = 0.22;
      }
    }
    for (const it of this.items.values()) {
      it.cur += (it.target - it.cur) * Math.min(1, dt * 8);
      const fading = it.cur < 0.98;
      for (const m of it.mats) {
        m.transparent = fading || m.userData.baseTransparent;
        m.opacity = (m.userData.baseOpacity as number) * it.cur;
        m.depthWrite = !fading;
      }
    }
  }
}
