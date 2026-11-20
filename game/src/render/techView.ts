import * as THREE from 'three';
import { CHECKPOINTS, FORECAST, GUARD_LANE_Z, HIDE_SPOTS, LIGHT_ZONES, PATROL, SOLIDS } from '../sim/level';
import { GUARD } from '../sim/guard';
import type { Simulation } from '../sim/world';

/**
 * Technical layer: greybox geometry from the collision data + live debug drawing of the AI.
 * Can be shown alone (tech view) or overlaid on the visual layer (debug overlay).
 */

const KIND_COLORS: Record<string, number> = {
  floor: 0x2a2f3a,
  wall: 0x3a3f4a,
  block: 0x4a5160,
  cabinet: 0x5a6a72,
  crate: 0x8a6a46,
  counter: 0x7a5a3a,
  shutter: 0x777777,
  mezzanine: 0x6a6f7a,
  parapet: 0x9aa0aa,
};

export class TechView {
  readonly greybox = new THREE.Group();
  readonly debug = new THREE.Group();
  readonly leonProxy: THREE.Mesh;
  readonly guardProxy: THREE.Mesh;
  private readonly lines: THREE.LineSegments;
  private readonly linePos: Float32Array;
  private readonly lineCol: Float32Array;
  private readonly maxSeg = 400;
  private segN = 0;

  constructor() {
    for (const s of SOLIDS) {
      if (s.id === 'floor') continue;
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      const mat = new THREE.MeshLambertMaterial({ color: KIND_COLORS[s.kind] ?? 0x888888, transparent: s.noCollide, opacity: s.noCollide ? 0.35 : 1 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, s.kind === 'parapet' ? 0.1 : 1.2), mat);
      m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0);
      this.greybox.add(m);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x0b0d10 }));
      edges.position.copy(m.position);
      this.greybox.add(edges);
    }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(120, 30).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x23262d }));
    fl.position.set(5, 0, -5);
    this.greybox.add(fl);
    const grid = new THREE.GridHelper(120, 120, 0x3a3f4a, 0x2d3139);
    grid.position.set(5, 0.002, -5);
    this.greybox.add(grid);
    this.greybox.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2);
    dl.position.set(5, 10, 8);
    this.greybox.add(dl);

    this.leonProxy = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 10), new THREE.MeshLambertMaterial({ color: 0xffa040 }));
    this.guardProxy = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.55, 4, 10), new THREE.MeshLambertMaterial({ color: 0x5ff2ff }));
    this.greybox.add(this.leonProxy, this.guardProxy);

    // Static annotations: hide spots, light zones, checkpoints, patrol, forecast corridor.
    for (const h of HIDE_SPOTS) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(h.reach * 2, 2.2, 0.3), new THREE.MeshBasicMaterial({ color: h.forecast ? 0x5ff2ff : 0x3fd07a, transparent: true, opacity: 0.35, depthWrite: false }));
      m.position.set(h.x, 1.1, -0.8);
      this.debug.add(m);
    }
    for (const z of LIGHT_ZONES) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(z.radius - 0.04, z.radius, 48), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.5 * z.intensity, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.set(z.x, z.y, 0.05);
      this.debug.add(ring);
    }
    for (const c of CHECKPOINTS) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0x9cff6a }));
      m.position.set(c.x, c.y + 2.4, 0);
      m.rotation.x = Math.PI;
      this.debug.add(m);
    }
    const fc = new THREE.Mesh(new THREE.PlaneGeometry(FORECAST.corridor.x1 - FORECAST.corridor.x0, 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5ff2ff, transparent: true, opacity: 0.25, depthWrite: false }));
    fc.position.set((FORECAST.corridor.x0 + FORECAST.corridor.x1) / 2, 0.02, 0);
    this.debug.add(fc);
    for (const p of PATROL) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0x5ff2ff }));
      m.position.set(p.x, 0.03, GUARD_LANE_Z);
      this.debug.add(m);
    }

    const geo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(this.maxSeg * 6);
    this.lineCol = new Float32Array(this.maxSeg * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 20;
    this.debug.add(this.lines);
    this.debug.add(this.markers);
  }

  /** Playtest death markers: red crosses where Leon was caught (this session = bright, earlier sessions = dim). */
  readonly markers = new THREE.Group();
  setMarkers(points: { x: number; y: number; old?: boolean }[]): void {
    for (const c of [...this.markers.children]) {
      this.markers.remove(c);
      (c as THREE.Line).geometry.dispose();
    }
    for (const p of points) {
      const s = 0.35;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.x - s, p.y + 0.9 - s, 0.4), new THREE.Vector3(p.x + s, p.y + 0.9 + s, 0.4),
        new THREE.Vector3(p.x - s, p.y + 0.9 + s, 0.4), new THREE.Vector3(p.x + s, p.y + 0.9 - s, 0.4),
      ]);
      this.markers.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: p.old ? 0x7a2a2a : 0xff3b3b, transparent: true, opacity: p.old ? 0.6 : 1 })));
    }
  }

  private seg(ax: number, ay: number, bx: number, by: number, c: THREE.Color, z = 0.3): void {
    if (this.segN >= this.maxSeg) return;
    const i = this.segN * 6;
    this.linePos.set([ax, ay, z, bx, by, z], i);
    this.lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], i);
    this.segN++;
  }

  update(sim: Simulation): void {
    const l = sim.leon;
    const g = sim.guard;
    this.leonProxy.position.set(l.x, l.y + l.height / 2, 0);
    this.leonProxy.scale.y = l.height / 1.7;
    (this.leonProxy.material as THREE.MeshLambertMaterial).color.set(l.mode === 'hidden' ? 0x3fd07a : l.exposure > 0 ? 0xff4040 : 0xffa040);
    this.guardProxy.position.set(g.x, 1.08, GUARD_LANE_Z);

    this.segN = 0;
    const eyeX = g.x;
    const eyeY = g.y + GUARD.eyeY;
    const cyan = new THREE.Color(0x5ff2ff);
    const amber = new THREE.Color(0xffb13a);
    const red = new THREE.Color(0xff3247);
    const green = new THREE.Color(0x3fff7a);
    const grey = new THREE.Color(0x777777);
    const modeCol = g.mode === 'chase' ? red : g.mode === 'patrol' || g.mode === 'return' ? cyan : amber;
    // Vision cone outline (in the gameplay plane) at the current range.
    const r = g.sight.range || 8;
    const up = (GUARD.coneUpDeg * Math.PI) / 180;
    const dn = (-GUARD.coneDownDeg * Math.PI) / 180;
    const dir = g.lookDir;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = dn + ((up - dn) * i) / 12;
      pts.push([eyeX + dir * Math.cos(a) * r, eyeY + Math.sin(a) * r]);
    }
    this.seg(eyeX, eyeY, pts[0][0], pts[0][1], modeCol);
    this.seg(eyeX, eyeY, pts[12][0], pts[12][1], modeCol);
    for (let i = 0; i < 12; i++) this.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], modeCol);
    // Near-sense circle
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = ((i + 1) / 16) * Math.PI * 2;
      this.seg(eyeX + Math.cos(a0) * GUARD.nearSense, eyeY + Math.sin(a0) * GUARD.nearSense, eyeX + Math.cos(a1) * GUARD.nearSense, eyeY + Math.sin(a1) * GUARD.nearSense, grey);
    }
    // Line-of-sight rays to Leon's sample points.
    for (const s of g.sight.samples) {
      const c = !s.inCone ? grey : s.blocked ? red : green;
      if (s.inCone || Math.abs(s.x - eyeX) < 14) this.seg(eyeX, eyeY, s.x, s.y, c);
    }
    // Last known position marker
    if (g.lastKnown) {
      const { x, y } = g.lastKnown;
      this.seg(x - 0.3, y + 0.05, x + 0.3, y + 0.65, amber);
      this.seg(x + 0.3, y + 0.05, x - 0.3, y + 0.65, amber);
    }
    // Noise rings
    for (const n of sim.recentNoises) {
      const age = sim.time - n.t;
      const rr = n.radius * Math.min(1, age * 3);
      const col = new THREE.Color(0xffffff).multiplyScalar(Math.max(0, 1 - age / 1.2));
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI * 2;
        const a1 = ((i + 1) / 24) * Math.PI * 2;
        this.seg(n.x + Math.cos(a0) * rr, n.y + Math.sin(a0) * rr, n.x + Math.cos(a1) * rr, n.y + Math.sin(a1) * rr, col);
      }
    }
    // Moving / state-dependent solids (cages, cart, gates, hatch, terminal door): outlined live.
    const dynCol = new THREE.Color(0xff9a3c);
    for (const sd of sim.solidsNow) {
      if (!['cage', 'cart', 'gate', 'hatch', 'door'].includes(sd.kind)) continue;
      this.seg(sd.x0, sd.y0, sd.x1, sd.y0, dynCol, 0.7);
      this.seg(sd.x1, sd.y0, sd.x1, sd.y1, dynCol, 0.7);
      this.seg(sd.x1, sd.y1, sd.x0, sd.y1, dynCol, 0.7);
      this.seg(sd.x0, sd.y1, sd.x0, sd.y0, dynCol, 0.7);
    }
    // Chase: MIRROR's predicted position of Leon.
    if (sim.chase.active) {
      const pr = sim.chase.predicted;
      const py = pr.lane === 'catwalk' ? 4.4 : pr.lane === 'tunnel' ? -1.35 : 0;
      this.seg(pr.x - 0.35, py + 0.1, pr.x + 0.35, py + 0.1, cyan, 0.7);
      this.seg(pr.x, py + 0.1, pr.x, py + 2.0, cyan, 0.7);
    }
    const geo = this.lines.geometry;
    geo.setDrawRange(0, this.segN * 2);
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
