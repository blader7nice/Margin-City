import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Assets } from './assets';
import { makeMats, mesh, worldBox, flutedColumn, type Mats } from './hall';
import { canvasTexture, hazardStripes, radialSprite, signTexture } from './canvasTex';
import type { LightPool } from './lightPool';
import { CATWALK_Y, CHASE, LEDGE_Y, PUZZLE, SOLIDS, TUNNEL_Y } from '../sim/level';
import { masses } from '../sim/puzzle';
import type { Simulation } from '../sim/world';
import type { Solid } from '../sim/types';

/**
 * Visuals for Milestone 02:
 *  - corridor puzzle "The Archivist's Balance" (brass cages, pulley, chain, ledger cart, balance dial, lever, hatch)
 *  - archive wing B (stacks, catwalk, MIRROR gates + forecast lights, spiral stairs, paper drift, service duct
 *    cutaway, terminal room B-12 with a closing glass door, alarm beacons).
 * Everything is driven by simulation state; nothing here affects gameplay.
 */

export interface ArchiveRefs {
  root: THREE.Group;
  update: (sim: Simulation, t: number, dt: number) => void;
  /** Where MM-01 should be drawn (archive-specific depth, spiral stairs, hidden in the passage). */
  mmPose: (sim: Simulation) => { x: number; y: number; z: number; visible: boolean } | null;
  occluders: THREE.Object3D[];
}

const sid = (id: string): Solid => {
  const s = SOLIDS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

/** Orient a unit-height cylinder between two points. */
function between(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, Math.max(0.001, len), 1);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

function monitorCanvas(): { tex: THREE.CanvasTexture; set: (lines: string[], color?: string) => void } {
  const W = 1024;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  const set = (lines: string[], color = '#6ff3ff') => {
    const key = lines.join('|') + color;
    if (key === last) return;
    last = key;
    ctx.fillStyle = '#020a0d';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.font = `500 30px 'Courier New', monospace`;
    ctx.fillText('MIRROR // ARCHIVE WING B', 34, 52);
    ctx.font = `bold 44px 'Courier New', monospace`;
    lines.forEach((ln, i) => ctx.fillText(ln, 34, 118 + i * 58, W - 68));
    ctx.shadowBlur = 0;
    tex.needsUpdate = true;
  };
  set(['MONITORING', 'NO ANOMALIES']);
  return { tex, set };
}

export function buildArchive(a: Assets, lights: LightPool): ArchiveRefs {
  const root = new THREE.Group();
  root.name = 'archive';
  const M: Mats = makeMats(a);
  const occluders: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T) => {
    root.add(o);
    return o;
  };
  const updaters: ((sim: Simulation, t: number, dt: number) => void)[] = [];

  const iron = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.75, roughness: 0.5 });
  const ironDark = new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.6, roughness: 0.6 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.95, normalMap: a.get('stone_normal') });
  const planks = M.wood.clone();
  planks.color = new THREE.Color(0xb3a08a);
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.08).multiplyScalar(2.5) });
  const amberLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.2).multiplyScalar(2.6) });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.37, 0.95, 1).multiplyScalar(2.2), transparent: true });
  const ledCool = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.85, 1).multiplyScalar(2.4) });
  const ledWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.4).multiplyScalar(1.1) });

  // =====================================================================================================
  // CORRIDOR PUZZLE — "The Archivist's Balance"
  // =====================================================================================================
  // Crate step to the gallery
  {
    const s = sid('crateCorridor');
    for (let r = 0; r < 4; r++)
      for (let d = 0; d < 2; d++) {
        const b = mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.04), M.kraft, (s.x0 + s.x1) / 2 + Math.sin(r * 3.1) * 0.03, 0.29 + r * 0.575, -0.3 - d * 0.62);
        b.scale.set(s.x1 - s.x0 - 0.04, 0.56, 0.6);
        b.rotation.y = Math.sin(r * 1.7 + d) * 0.05;
        add(b);
      }
  }
  // Gallery (cart starts here)
  {
    const s = sid('gallery');
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    add(mesh(worldBox(w, 0.3, 2.4, 2), M.wood, cx, LEDGE_Y - 0.15, -0.3));
    add(mesh(new THREE.BoxGeometry(w, 0.06, 0.08), M.brass, cx, LEDGE_Y + 0.95, -1.45));
    for (let x = s.x0 + 0.2; x < s.x1; x += 0.35) add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), M.bronzeDark, x, LEDGE_Y + 0.47, -1.45, false, false));
    add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), M.brass, s.x0 + 0.08, LEDGE_Y + 0.3, -0.3)); // bumper post
    for (const x of [s.x0 + 0.4, s.x1 - 0.4]) add(mesh(flutedColumn(0.12, LEDGE_Y - 0.3, 8, 20), M.stone, x, (LEDGE_Y - 0.3) / 2, -1.2));
  }
  // Ledger cart
  const cart = new THREE.Group();
  {
    const wood = M.wood;
    cart.add(mesh(new RoundedBoxGeometry(1.0, 0.12, 0.9, 2, 0.03), wood, 0, 0.24, 0));
    cart.add(mesh(new RoundedBoxGeometry(1.0, 0.08, 0.9, 2, 0.02), wood, 0, 0.62, 0));
    for (const [x, z] of [
      [-0.38, -0.33],
      [0.38, -0.33],
      [-0.38, 0.33],
      [0.38, 0.33],
    ]) {
      cart.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14).rotateX(Math.PI / 2), ironDark, x, 0.11, z));
      cart.add(mesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), M.brass, x * 1.18, 0.5, z * 1.2));
    }
    // ledgers (heavy): two shelves of thick books
    const cols = [0x5b1d1d, 0x1f3b2c, 0x3a2a18, 0x26304a, 0x6b4a22];
    for (let shelf = 0; shelf < 2; shelf++)
      for (let i = 0; i < 9; i++) {
        const h = 0.26 + ((i * 37) % 7) * 0.012;
        const book = mesh(new THREE.BoxGeometry(0.09, h, 0.34), new THREE.MeshStandardMaterial({ color: cols[(i + shelf) % cols.length], roughness: 0.7 }), -0.42 + i * 0.105, 0.3 + shelf * 0.38 + h / 2, -0.15 + (i % 2) * 0.3);
        cart.add(book);
      }
    cart.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8).rotateX(Math.PI / 2), M.brass, -0.55, 0.92, 0));
    const lbl = new THREE.MeshBasicMaterial({ map: signTexture('LEDGERS 1987–1994 · 240 KG', { w: 1024, h: 120, bg: '#e9dfc4', fg: '#3a2410', font: `600 50px 'Courier New', monospace` }) });
    cart.add(mesh(new THREE.PlaneGeometry(0.8, 0.1), lbl, 0, 0.42, 0.455, false, false));
    add(cart);
  }

  // Cages (Deco brass lattice lifts)
  const buildCage = (withLever: boolean) => {
    const g = new THREE.Group();
    const w = PUZZLE.cageL.x1 - PUZZLE.cageL.x0;
    const d = 1.8;
    const h = 2.45;
    g.add(mesh(new THREE.BoxGeometry(w, 0.15, d), ironDark, 0, -0.075, 0));
    g.add(mesh(new THREE.BoxGeometry(w, 0.02, d - 0.1), M.brass, 0, 0.005, 0, false, true));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.06, h, 0.06), M.brass, (sx * w) / 2, h / 2, (sz * d) / 2));
    g.add(mesh(new THREE.BoxGeometry(w + 0.08, 0.08, d + 0.08), M.brass, 0, h, 0));
    // back + right lattice (bars) — the open sides stay readable
    const bar = new THREE.CylinderGeometry(0.012, 0.012, h, 5);
    for (let i = 1; i < 9; i++) g.add(mesh(bar, M.bronzeDark, -w / 2 + (w * i) / 9, h / 2, -d / 2, false, false));
    // Deco crown fan
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24, 0, Math.PI), M.frieze);
    fan.position.set(0, h + 0.04, -d / 2 + 0.02);
    g.add(fan);
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 10), M.brass, 0, h + 0.15, 0));
    let lever: THREE.Group | null = null;
    if (withLever) {
      lever = new THREE.Group();
      lever.add(mesh(new THREE.BoxGeometry(0.1, 0.26, 0.08), ironDark, 0, 0, 0));
      const arm = new THREE.Group();
      arm.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), M.brass, 0, 0.25, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), red, 0, 0.5, 0, false, false));
      arm.name = 'arm';
      lever.add(arm);
      lever.position.set(w / 2 - 0.12, 1.0, -d / 2 + 0.15);
      g.add(lever);
    }
    return { g, lever };
  };
  const cageL = buildCage(false);
  const cageR = buildCage(true);
  const gateBars = new THREE.Group();
  for (let i = 0; i < 6; i++) gateBars.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 5), M.brass, 0, 0.6, -0.75 + i * 0.3, false, false));
  cageL.g.add(gateBars);
  gateBars.position.x = -(PUZZLE.cageL.x1 - PUZZLE.cageL.x0) / 2 + 0.05;
  add(cageL.g);
  add(cageR.g);
  // Shaft guide rails
  for (const c of [PUZZLE.cageL, PUZZLE.cageR])
    for (const x of [c.x0 - 0.05, c.x1 + 0.05]) add(mesh(new THREE.BoxGeometry(0.06, 7.0, 0.1), iron, x, 3.5, -0.95));
  // Pulley + chains
  const pulley = new THREE.Group();
  {
    const r = 1.15;
    pulley.add(mesh(new THREE.TorusGeometry(r, 0.07, 10, 48), M.brass, 0, 0, 0));
    for (let k = 0; k < 8; k++) {
      const sp = mesh(new THREE.CylinderGeometry(0.03, 0.03, r * 2, 6), M.bronzeDark, 0, 0, 0, false, false);
      sp.rotation.z = (k / 8) * Math.PI;
      pulley.add(sp);
    }
    pulley.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16).rotateX(Math.PI / 2), M.brass, 0, 0, 0));
    pulley.position.set(PUZZLE.pulleyX, PUZZLE.pulleyY, -0.2);
    add(pulley);
    add(mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), iron, PUZZLE.pulleyX, PUZZLE.pulleyY + 0.6, -0.2));
  }
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x8b7a5c, metalness: 0.9, roughness: 0.4 });
  const chainL = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), chainMat));
  const chainR = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), chainMat));
  // Balance dial on the corridor back wall
  const needle = new THREE.Group();
  {
    const face = canvasTexture(512, 512, (ctx) => {
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.arc(256, 256, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.lineWidth = 6;
      for (let i = -5; i <= 5; i++) {
        const ang = -Math.PI / 2 + i * 0.22;
        ctx.beginPath();
        ctx.moveTo(256 + Math.cos(ang) * 200, 256 + Math.sin(ang) * 200);
        ctx.lineTo(256 + Math.cos(ang) * (i === 0 ? 150 : 175), 256 + Math.sin(ang) * (i === 0 ? 150 : 175));
        ctx.stroke();
      }
      ctx.fillStyle = '#3a2410';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('L', 120, 300);
      ctx.fillText('R', 392, 300);
      ctx.font = '600 34px Georgia, serif';
      ctx.fillText('BALANCE', 256, 380);
    });
    const dial = mesh(new THREE.CircleGeometry(0.62, 40), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }), PUZZLE.pulleyX, 3.0, -3.42, false, false);
    add(dial);
    add(mesh(new THREE.TorusGeometry(0.64, 0.05, 8, 40), M.brass, PUZZLE.pulleyX, 3.0, -3.4, false, false));
    needle.add(mesh(new THREE.BoxGeometry(0.035, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x1a0f05 }), 0, 0.22, 0, false, false));
    needle.position.set(PUZZLE.pulleyX, 3.0, -3.37);
    add(needle);
  }
  lights.add({ position: [PUZZLE.pulleyX, 5.3, 1.0], color: 0xffc27a, intensity: 18, distance: 11, decay: 2 });
  add(mesh(new THREE.SphereGeometry(0.12, 12, 8), amberLamp, PUZZLE.pulleyX, 5.45, 0.9, false, false));
  add(mesh(new THREE.ConeGeometry(0.3, 0.25, 16, 1, true), M.brass, PUZZLE.pulleyX, 5.6, 0.9, false, false));

  // Broken ledge + emergency panel + hatch
  {
    const s = sid('brokenLedge');
    add(mesh(worldBox(s.x1 - s.x0, 0.3, 2.2, 2), M.wood, (s.x0 + s.x1) / 2, LEDGE_Y - 0.15, -0.35));
    for (let x = s.x0 + 0.5; x < s.x1; x += 0.6) add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), M.bronzeDark, x, LEDGE_Y + 0.45, -1.4, false, false));
    const broken = mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), M.brass, s.x0 + 0.6, LEDGE_Y + 0.6, -1.4);
    broken.rotation.z = -0.5;
    add(broken);
    for (const x of [s.x0 + 0.6, s.x1 - 0.6]) add(mesh(new THREE.BoxGeometry(0.2, LEDGE_Y - 0.3, 0.2), iron, x, (LEDGE_Y - 0.3) / 2, -1.3));
  }
  const panelLamp = mesh(new THREE.SphereGeometry(0.08, 10, 8), red, PUZZLE.panel.x + 0.35, LEDGE_Y + 1.85, -1.12, false, false);
  {
    add(mesh(new RoundedBoxGeometry(0.75, 0.95, 0.22, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0x7a1a14, roughness: 0.5, metalness: 0.3 }), PUZZLE.panel.x, LEDGE_Y + 1.25, -1.25));
    const sign = new THREE.MeshBasicMaterial({ map: signTexture('EMERGENCY RELEASE · TRIGGERS ALARM', { w: 1024, h: 140, bg: '#1a0303', fg: '#ff6a4a', glow: '#ff2a1a', font: `bold 50px 'Courier New', monospace` }) });
    add(mesh(new THREE.PlaneGeometry(1.7, 0.23), sign, PUZZLE.panel.x - 0.35, LEDGE_Y + 2.05, -1.2, false, false));
    add(panelLamp);
  }
  const hatch = new THREE.Group();
  {
    const hh = PUZZLE.hatch.y1 - PUZZLE.hatch.y0;
    const door = mesh(new THREE.BoxGeometry(0.12, hh, 2.0), iron, 0, hh / 2, 1.0);
    hatch.add(door);
    for (let i = 0; i < 4; i++) hatch.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 1.9), ironDark, 0, 0.35 + i * 0.5, 1.0, false, false));
    const stripes = new THREE.MeshStandardMaterial({ map: hazardStripes(), roughness: 0.7 });
    hatch.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 2.0), stripes, 0, 0.07, 1.0, false, false));
    hatch.position.set(43.98, PUZZLE.hatch.y0, -1.0);
    add(hatch);
  }

  // =====================================================================================================
  // ARCHIVE WING B
  // =====================================================================================================
  const AX0 = 45;
  const AX1 = 100.5;
  // Floor slab segments with real holes for the duct grates (cut-away front at z = +1.2)
  for (const [x0, x1] of [
    [AX0, 80.0],
    [81.2, 95.0],
    [96.2, AX1],
  ]) {
    add(mesh(worldBox(x1 - x0, 0.2, 14, 1.5), planks, (x0 + x1) / 2, -0.1, -5.8));
  }
  // Floor in front of the gameplay lane (toward the camera) — the duct stays visible from the low duct camera.
  add(mesh(worldBox(AX1 - AX0, 0.2, 12.8, 1.5), planks, (AX0 + AX1) / 2, -0.1, 7.6));
  // Solid section below the floor (concrete), open where the duct is
  add(mesh(worldBox(79.0 - AX0, 2.8, 14), concrete, (AX0 + 79.0) / 2, -1.6, -5.8, false, true));
  add(mesh(worldBox(AX1 - 98, 2.8, 14), concrete, (98 + AX1) / 2, -1.6, -5.8, false, true));
  // Duct (cut-away): bed, back wall, pipes, small lamps
  {
    add(mesh(worldBox(98 - 79, 0.3, 2.2), concrete, (79 + 98) / 2, TUNNEL_Y - 0.15, -0.2));
    add(mesh(worldBox(98 - 79, 1.6, 0.3), M.stoneDark, (79 + 98) / 2, TUNNEL_Y + 0.6, -1.25));
    add(mesh(worldBox(98 - 79, 2.8, 12), concrete, (79 + 98) / 2, -1.6 - 0.35, -7.6, false, true));
    const pipe = new THREE.CylinderGeometry(0.08, 0.08, 98 - 79, 10).rotateZ(Math.PI / 2);
    add(mesh(pipe, M.brass, (79 + 98) / 2, -0.55, -1.0));
    add(mesh(pipe, iron, (79 + 98) / 2, -0.75, -1.05));
    for (const x of [83.5, 89.5, 94]) {
      add(mesh(new THREE.SphereGeometry(0.06, 8, 6), amberLamp, x, -0.42, -1.05, false, false));
      lights.add({ position: [x, -0.55, -0.6], color: 0xffb36a, intensity: 3.2, distance: 4.5, decay: 2 });
    }
  }
  // Grates over the duct openings
  const grate = (x0: number, x1: number) => {
    for (let x = x0 + 0.05; x < x1; x += 0.12) add(mesh(new THREE.BoxGeometry(0.035, 0.05, 2.4), ironDark, x, -0.03, -0.2, false, true));
    add(mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 0.08), ironDark, (x0 + x1) / 2, -0.03, 1.0, false, false));
    add(mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 0.08), ironDark, (x0 + x1) / 2, -0.03, -1.4, false, false));
  };
  grate(80.0, 81.2);
  grate(95.0, 96.2);
  // Warm light leaking up through the entry grate: the third way is visible if you look.
  {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 2.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: radialSprite('rgba(255,170,90,0.9)', 'rgba(255,170,90,0)'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.set(80.6, 0.02, -0.2);
    add(glow);
    const plate = new THREE.MeshBasicMaterial({ map: signTexture('SERVICE DUCT → B-12', { w: 1024, h: 140, bg: '#1d1408', fg: '#ffc27a', font: `600 54px 'Courier New', monospace` }) });
    add(mesh(new THREE.PlaneGeometry(1.5, 0.2), plate, 80.6, 0.55, -1.45, false, false));
  }
  // Back wall, ceiling
  add(mesh(worldBox(AX1 - AX0, 14, 0.5), M.stoneDark, (AX0 + AX1) / 2, 7, -12.6, false, true));
  // Ceiling with skylight wells (does not block the cool moon fill — the archive reads as a volume, not a cave).
  add(mesh(worldBox(AX1 - AX0, 0.6, 14), M.stoneDark, (AX0 + AX1) / 2, 9.9, -5.4, false, false));
  for (let x = AX0 + 2; x < AX1; x += 4) add(mesh(new THREE.BoxGeometry(0.3, 0.5, 14), iron, x, 9.4, -5.4, false, false));
  // High small windows with rain light
  const sky = new THREE.MeshBasicMaterial({ map: a.get('skyline', 1, 1), color: new THREE.Color(0.7, 0.8, 1.0) });
  for (let x = AX0 + 4; x < AX1 - 2; x += 8) {
    add(mesh(new THREE.PlaneGeometry(2.2, 1.4), sky, x, 8.2, -12.3, false, false));
    add(mesh(new THREE.BoxGeometry(2.4, 0.08, 0.1), iron, x, 8.2, -12.25, false, false));
  }

  // Background stacks (library echo): rows of shelving seen end-on, aisles between.
  {
    const unitW = 0.9;
    const xs: number[] = [];
    for (let x = 46.6; x < 99.5; x += 2.5) {
      if (Math.abs(x - CHASE.mmEntryX) < 1.3 || Math.abs(x - CHASE.passageDoorX) < 1.3) continue;
      if (CHASE.stairs.some((s) => Math.abs(x - s) < 1.6)) continue;
      if (x > 91.5) continue;
      xs.push(x);
    }
    const depth = 7.4;
    const zc = -3.4 - depth / 2;
    const sideGeo = new THREE.BoxGeometry(0.04, 5.6, depth);
    const endGeo = new THREE.BoxGeometry(unitW, 5.6, 0.06);
    const shelfGeo = new THREE.BoxGeometry(unitW, 0.04, depth);
    const boxGeo = new THREE.BoxGeometry(0.34, 0.3, 0.42);
    const ends = new THREE.InstancedMesh(endGeo, planks, xs.length);
    const sides = new THREE.InstancedMesh(sideGeo, iron, xs.length * 2);
    const shelves = new THREE.InstancedMesh(shelfGeo, iron, xs.length * 6);
    const boxesPerUnit = 2 * 5 * 12;
    const boxes = new THREE.InstancedMesh(boxGeo, M.kraft, xs.length * boxesPerUnit);
    const m4 = new THREE.Matrix4();
    let bi = 0;
    xs.forEach((x, i) => {
      ends.setMatrixAt(i, m4.makeTranslation(x, 2.8, -3.4));
      sides.setMatrixAt(i * 2, m4.makeTranslation(x - unitW / 2, 2.8, zc));
      sides.setMatrixAt(i * 2 + 1, m4.makeTranslation(x + unitW / 2, 2.8, zc));
      for (let s = 0; s < 6; s++) shelves.setMatrixAt(i * 6 + s, m4.makeTranslation(x, 0.25 + s * 1.05, zc));
      for (const side of [-1, 1])
        for (let s = 0; s < 5; s++)
          for (let k = 0; k < 12; k++) {
            const jitter = Math.sin(i * 13.1 + s * 7.7 + k * 3.3);
            m4.makeTranslation(x + side * 0.22, 0.43 + s * 1.05, -3.8 - k * 0.58 + jitter * 0.05);
            boxes.setMatrixAt(bi++, m4);
          }
    });
    for (const im of [ends, sides, shelves, boxes]) {
      im.castShadow = false;
      im.receiveShadow = true;
      add(im);
    }
    // brass label plates on the stack ends
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xc9944a, metalness: 1, roughness: 0.35 });
    const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.16, 0.02), plateMat, xs.length);
    xs.forEach((x, i) => plates.setMatrixAt(i, m4.makeTranslation(x, 2.0, -3.36)));
    add(plates);
  }

  // Catwalk (upper lane): grating, rails, hangers
  const grateTex = canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 128; i += 16) {
      ctx.fillRect(i, 0, 5, 128);
      ctx.fillRect(0, i, 128, 3);
    }
  });
  grateTex.wrapS = grateTex.wrapT = THREE.RepeatWrapping;
  for (const id of ['catwalk1', 'catwalk2', 'catwalk3', 'catwalk4']) {
    const s = sid(id);
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    const t = grateTex.clone();
    t.repeat.set(w * 2, 3);
    t.needsUpdate = true;
    const gm = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.8, roughness: 0.45, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
    add(mesh(new THREE.BoxGeometry(w, 0.05, 1.7), gm, cx, CATWALK_Y - 0.03, -0.15));
    add(mesh(new THREE.BoxGeometry(w, 0.18, 0.06), iron, cx, CATWALK_Y - 0.09, 0.72));
    add(mesh(new THREE.BoxGeometry(w, 0.18, 0.06), iron, cx, CATWALK_Y - 0.09, -1.0));
    // rails (camera side kept low and thin)
    add(mesh(new THREE.BoxGeometry(w, 0.04, 0.04), iron, cx, CATWALK_Y + 1.0, -1.0, false, false));
    add(mesh(new THREE.BoxGeometry(w, 0.03, 0.03), iron, cx, CATWALK_Y + 0.95, 0.72, false, false));
    for (let x = s.x0 + 0.3; x < s.x1; x += 1.5) {
      add(mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), iron, x, CATWALK_Y + 0.5, -1.0, false, false));
      add(mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), iron, x, CATWALK_Y + 0.47, 0.72, false, false));
    }
    for (let x = s.x0 + 1.0; x < s.x1; x += 3.5) add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 9.6 - CATWALK_Y, 5), iron, x, (9.6 + CATWALK_Y) / 2, -0.95, false, false));
    // Cool LED edge strip: the upper lane reads at a glance, even under the red alarm.
    add(mesh(new THREE.BoxGeometry(w, 0.03, 0.03), ledCool, cx, CATWALK_Y - 0.17, 0.76, false, false));
  }
  // Warm floor-lane guide strip along the stacks (lower lane)
  add(mesh(new THREE.BoxGeometry(92 - 45.5, 0.02, 0.04), ledWarm, (45.5 + 92) / 2, 0.012, -1.05, false, false));
  // Climbable stacks in the lane + archive crate
  for (const id of ['stack1', 'stack2']) {
    const s = sid(id);
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    add(mesh(worldBox(w, 0.06, 1.4), planks, cx, s.y1 - 0.03, -0.2));
    for (const sx of [s.x0 + 0.03, s.x1 - 0.03]) add(mesh(new THREE.BoxGeometry(0.05, s.y1, 1.4), iron, sx, s.y1 / 2, -0.2));
    for (let r = 0; r < 3; r++) {
      add(mesh(new THREE.BoxGeometry(w, 0.04, 1.4), iron, cx, 0.1 + r * 0.72, -0.2, false, true));
      for (let k = 0; k < 3; k++) {
        const b = mesh(new RoundedBoxGeometry(0.42, 0.5, 0.9, 2, 0.03), M.kraft, s.x0 + 0.28 + k * 0.44, 0.38 + r * 0.72, -0.2);
        b.rotation.y = Math.sin(k * 2.3 + r) * 0.06;
        add(b);
      }
    }
  }
  {
    const s = sid('crateArchive');
    const b = mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.04), M.kraft, (s.x0 + s.x1) / 2, 0.5, -0.2);
    b.scale.set(s.x1 - s.x0, s.y1, 1.0);
    add(b);
  }
  // Paper drift (slows everyone)
  {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.95 }));
    mound.scale.set((CHASE.drift.x1 - CHASE.drift.x0) / 2 + 0.4, 0.35, 1.6);
    mound.position.set((CHASE.drift.x0 + CHASE.drift.x1) / 2, -0.12, -0.2);
    mound.receiveShadow = true;
    add(mound);
    const paperMat = new THREE.MeshStandardMaterial({ map: a.get('paper_atlas'), alphaTest: 0.5, roughness: 0.95, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(0.21, 0.29);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5 + 0.5);
    const n = 700;
    const im = new THREE.InstancedMesh(geo, paperMat, n);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const x = (CHASE.drift.x0 + CHASE.drift.x1) / 2 + u * ((CHASE.drift.x1 - CHASE.drift.x0) / 2 + 0.6);
      const z = -0.2 + (rnd() * 2 - 1) * 1.5;
      const hgt = Math.max(0, 0.36 * (1 - u * u) * (1 - ((z + 0.2) / 1.6) ** 2)) + rnd() * 0.08;
      q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (rnd() - 0.5) * 1.2, rnd() * 6.3, (rnd() - 0.5) * 1.2));
      m4.compose(new THREE.Vector3(x, hgt, z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
    }
    im.receiveShadow = true;
    add(im);
  }

  // MIRROR gates + forecast lights
  const gateMeshes: { group: THREE.Group; panel: THREE.Mesh; lamps: THREE.Mesh[]; id: string; laneY: number; top: number }[] = [];
  const shutterMat = M.steel.clone();
  (shutterMat.map as THREE.Texture).repeat.set(1, 4);
  for (const def of CHASE.gates) {
    const g = new THREE.Group();
    const laneY = def.lane === 'catwalk' ? CATWALK_Y : 0;
    const width = def.lane === 'catwalk' ? 2.1 : 3.4;
    const cx = (def.x0 + def.x1) / 2;
    for (const sz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.3, def.top - laneY + 0.2, 0.25), iron, cx, (laneY + def.top) / 2, -0.15 + (sz * width) / 2));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.35, width + 0.3), ironDark, cx, def.top + 0.1, -0.15));
    const panel = mesh(new THREE.BoxGeometry(0.16, 1, width), shutterMat, cx, 0, -0.15);
    g.add(panel);
    const stripes = new THREE.MeshStandardMaterial({ map: hazardStripes(), roughness: 0.7 });
    (stripes.map as THREE.Texture).repeat.set(3, 1);
    const edge = mesh(new THREE.BoxGeometry(0.18, 0.14, width), stripes, 0, 0, 0, false, false);
    edge.name = 'edge';
    g.add(edge);
    const lamps: THREE.Mesh[] = [];
    for (const sz of [-1, 1]) {
      const l = mesh(new THREE.SphereGeometry(0.09, 10, 8), amberLamp.clone(), cx - 0.2, def.top + 0.35, -0.15 + sz * (width / 2 - 0.2), false, false);
      g.add(l);
      lamps.push(l);
    }
    const sign = new THREE.MeshBasicMaterial({ map: signTexture(def.id, { w: 256, h: 128, bg: '#14100a', fg: '#ffc27a', font: `bold 80px 'Courier New', monospace` }) });
    g.add(mesh(new THREE.PlaneGeometry(0.5, 0.25), sign, cx - 0.26, def.top + 0.1, 1.0, false, false));
    add(g);
    gateMeshes.push({ group: g, panel, lamps, id: def.id, laneY, top: def.top });
  }
  const forecastStrips: { lane: 'floor' | 'catwalk'; mat: THREE.MeshBasicMaterial }[] = [];
  for (const lane of ['floor', 'catwalk'] as const) {
    const y = lane === 'catwalk' ? CATWALK_Y + 0.01 : 0.015;
    const gate = CHASE.gates.find((g) => g.lane === lane)!;
    const mat = cyan.clone();
    mat.opacity = 0;
    const len = gate.x0 - CHASE.gateDecisionX;
    for (const z of [0.55, -0.85]) add(mesh(new THREE.BoxGeometry(len, 0.012, 0.05), mat, CHASE.gateDecisionX + len / 2, y, z, false, false));
    forecastStrips.push({ lane, mat });
  }
  const gateLight = lights.add({ position: [65, 6, 1], color: 0xffa040, intensity: 0, distance: 10, decay: 2 });

  // MIRROR monitors
  const monitors: ReturnType<typeof monitorCanvas>[] = [];
  for (const [x, y] of [
    [56.5, 7.4],
    [79.5, 7.4],
  ]) {
    const m = monitorCanvas();
    monitors.push(m);
    const screen = mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: m.tex, color: new THREE.Color(1.3, 1.3, 1.3) }), x, y, -1.6, false, false);
    add(screen);
    add(mesh(new THREE.BoxGeometry(3.35, 0.95, 0.12), ironDark, x, y, -1.68, false, false));
    for (const dx of [-1.2, 1.2]) add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 9.6 - y, 4), iron, x + dx, (9.6 + y) / 2 + 0.4, -1.65, false, false));
  }

  // Doors: MM-01 entry, service passage
  const makeDoor = (x: number, label: string) => {
    const g = new THREE.Group();
    g.add(mesh(worldBox(2.6, 3.6, 0.5), M.stoneDark, x, 1.8, -3.1, false, true));
    const hole = mesh(new THREE.PlaneGeometry(1.5, 2.6), new THREE.MeshBasicMaterial({ color: 0x050608 }), x, 1.3, -2.83, false, false);
    g.add(hole);
    const leaves: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(x + side * 0.75, 0, -2.8);
      pivot.add(mesh(new THREE.BoxGeometry(0.75, 2.6, 0.06), iron, -side * 0.375, 1.3, 0));
      pivot.add(mesh(new THREE.BoxGeometry(0.5, 0.35, 0.02), new THREE.MeshBasicMaterial({ color: 0x223040 }), -side * 0.375, 1.9, 0.04, false, false));
      g.add(pivot);
      leaves.push(pivot);
    }
    const lamp = mesh(new THREE.SphereGeometry(0.11, 10, 8), cyan.clone(), x, 2.95, -2.7, false, false);
    g.add(lamp);
    const sign = new THREE.MeshBasicMaterial({ map: signTexture(label, { w: 512, h: 110, bg: '#120e08', fg: '#d9b27a', font: `600 52px 'Courier New', monospace` }) });
    g.add(mesh(new THREE.PlaneGeometry(1.4, 0.3), sign, x, 3.35, -2.83, false, false));
    add(g);
    return { leaves, lamp, open: 0 };
  };
  const entryDoor = makeDoor(CHASE.mmEntryX, 'STAIRWELL 2');
  const passageDoor = makeDoor(CHASE.passageDoorX, 'SERVICE · 3');

  // Spiral stairs (MM-01 changes level here)
  for (const sx of CHASE.stairs) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, CATWALK_Y + 1.2, 10), iron, sx, (CATWALK_Y + 1.2) / 2, -2.3));
    const n = 18;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const ang = k * Math.PI * 2 * 1.25;
      const step = mesh(new THREE.BoxGeometry(0.9, 0.05, 0.32), iron, sx + Math.cos(ang) * 0.5, k * CATWALK_Y + 0.12, -2.3 + Math.sin(ang) * 0.5);
      step.rotation.y = -ang;
      g.add(step);
    }
    // landing link to the catwalk
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.06, 1.5), iron, sx + 0.3, CATWALK_Y - 0.03, -1.6));
    add(g);
  }

  // Terminal room B-12 (safe room)
  const glassDoor = new THREE.Group();
  {
    const rx0 = CHASE.doorX1;
    const rx1 = 100;
    add(mesh(worldBox(rx1 - rx0, 3.6, 0.3), M.wood, (rx0 + rx1) / 2, 1.8, -2.4, false, true));
    add(mesh(worldBox(rx1 - rx0 + 0.6, 0.4, 3.6), M.stoneDark, (rx0 + rx1) / 2, 3.6, -0.8, true, false));
    add(mesh(worldBox(0.4, 3.6, 3.6), M.stoneDark, CHASE.doorX0 - 0.05, 1.8 + 0.0, -2.0 - 0.6, false, true));
    // door frame posts (camera side is a cut-away)
    add(mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), M.brass, CHASE.doorX0 + 0.15, 1.7, -1.35));
    add(mesh(new THREE.BoxGeometry(0.3, 0.3, 2.4), M.brass, CHASE.doorX0 + 0.15, 3.3, -0.2));
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fb6c8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });
    glassDoor.add(mesh(new THREE.BoxGeometry(0.06, 3.2, 2.2), glass, 0, 1.6, 0, false, false));
    glassDoor.add(mesh(new THREE.BoxGeometry(0.1, 3.2, 0.08), M.brass, 0, 1.6, 1.1, false, false));
    glassDoor.add(mesh(new THREE.BoxGeometry(0.1, 3.2, 0.08), M.brass, 0, 1.6, -1.1, false, false));
    glassDoor.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), M.brass, 0, 0.05, 0, false, false));
    glassDoor.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), M.brass, 0, 3.15, 0, false, false));
    glassDoor.position.set((CHASE.doorX0 + CHASE.doorX1) / 2, 3.2, -0.2);
    add(glassDoor);
    const sign = new THREE.MeshBasicMaterial({ map: signTexture('TERMINAL  B-12', { w: 1024, h: 180, bg: '#20160b', fg: '#ffcf86', glow: '#ff9d3a' }), color: new THREE.Color(1.2, 1.2, 1.2) });
    add(mesh(new THREE.PlaneGeometry(2.0, 0.36), sign, CHASE.doorX0 - 0.9, 3.75, -1.1, false, false));
    // desk + terminal (Market Replay is the next milestone)
    const dx = 97.4;
    add(mesh(worldBox(2.4, 0.08, 1.0), M.wood, dx, 0.82, -1.5));
    for (const ox of [-1.1, 1.1]) add(mesh(new THREE.BoxGeometry(0.08, 0.82, 0.9), M.wood, dx + ox, 0.41, -1.5));
    add(mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.6 }), dx, 1.12, -1.6));
    const scr = canvasTexture(256, 192, (ctx) => {
      ctx.fillStyle = '#04120a';
      ctx.fillRect(0, 0, 256, 192);
      ctx.fillStyle = '#7dffb0';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('B-12 >', 16, 40);
      ctx.fillText('REPLAY ARCHIVE', 16, 78);
      ctx.fillText('[ LOCKED ]', 16, 116);
      for (let i = 0; i < 9; i++) ctx.fillRect(18 + i * 24, 170 - ((i * 37) % 40), 12, 8);
    });
    add(mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1.4, 1.4, 1.4) }), dx, 1.14, -1.34, false, false));
    lights.add({ position: [dx, 2.6, -0.6], color: 0xffc282, intensity: 12, distance: 8, decay: 2 });
    add(mesh(new THREE.SphereGeometry(0.12, 12, 8), amberLamp, dx, 3.1, -1.0, false, false));
  }

  // Archive lamps + alarm beacons
  for (const x of [48, 52, 58, 64, 70, 76, 82, 88]) {
    const main = x === 52 || x === 76;
    add(mesh(new THREE.ConeGeometry(0.45, 0.35, 20, 1, true), iron, x, 7.0, -0.4, false, false));
    add(mesh(new THREE.SphereGeometry(0.13, 12, 8), amberLamp, x, 6.85, -0.4, false, false));
    add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.6, 4), iron, x, 8.4, -0.4, false, false));
    lights.add({ position: [x, 6.6, -0.2], color: 0xffbd7a, intensity: main ? 46 : 28, distance: main ? 0 : 16, decay: 2 });
  }
  // M04 readability: caged work lamps UNDER the catwalk — the catwalk shades the floor lane, where the chase often runs.
  for (const x of [58.5, 68.5, 78.5]) {
    add(mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), iron, x, 2.35, -1.62, false, false));
    add(mesh(new THREE.SphereGeometry(0.075, 10, 8), amberLamp, x, 2.27, -1.52, false, false));
    lights.add({ position: [x, 2.2, -1.1], color: 0xffb870, intensity: 9, distance: 7.5, decay: 2 });
  }
  // Cool bounce from the high windows onto the stacks (keeps the background readable).
  for (const x of [55, 71, 87]) lights.add({ position: [x, 8.0, -9.0], color: 0x7f9cff, intensity: 22, distance: 16, decay: 2 });
  let alarmOn = false;
  const alarmScale = (t: number) => (alarmOn ? 0.35 + 0.65 * Math.max(0, Math.sin(t * 6)) : 0);
  const beacons: THREE.Group[] = [];
  for (const x of [49, 64, 79, 93]) {
    const b = new THREE.Group();
    b.add(mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 0, 0, false, false));
    const beamMat = new THREE.MeshBasicMaterial({ map: radialSprite('rgba(255,40,30,0.6)', 'rgba(255,40,30,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), beamMat);
    beam.position.x = 1.3;
    const spin = new THREE.Group();
    spin.add(beam);
    b.add(spin);
    b.position.set(x, 8.6, -1.8);
    b.visible = false;
    add(b);
    beacons.push(b);
    lights.add({ position: [x, 7.8, -0.6], color: 0xff2a1a, intensity: 22, distance: 16, decay: 2, scale: alarmScale });
  }
  // Red spill through the open hatch into the corridor
  lights.add({ position: [44.6, 5.6, -0.8], color: 0xff3a24, intensity: 10, distance: 9, decay: 2, scale: alarmScale });

  // ----------------------------------------------------------------------------------------------- update
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let gateWarnT = 0;
  updaters.push((sim, t, dt) => {
    const p = sim.puzzle;
    const L = PUZZLE.cageL;
    const R = PUZZLE.cageR;
    cageL.g.position.set((L.x0 + L.x1) / 2, p.hL, -0.1);
    cageR.g.position.set((R.x0 + R.x1) / 2, p.hR, -0.1);
    cart.position.set(p.cart.x, p.cart.y, -0.25);
    gateBars.position.y = p.cart.locked ? 0 : 1.25;
    gateBars.visible = p.cart.locked;
    const arm = cageR.lever?.getObjectByName('arm');
    if (arm) arm.rotation.z += ((p.lever ? -0.9 : 0.5) - arm.rotation.z) * Math.min(1, dt * 10);
    pulley.rotation.z = -(PUZZLE.top - p.hL) / 1.15;
    const r = 1.15;
    tmpA.set((L.x0 + L.x1) / 2, p.hL + 2.6, -0.2);
    tmpB.set(PUZZLE.pulleyX - r, PUZZLE.pulleyY, -0.2);
    between(chainL, tmpA, tmpB);
    tmpA.set((R.x0 + R.x1) / 2, p.hR + 2.6, -0.2);
    tmpB.set(PUZZLE.pulleyX + r, PUZZLE.pulleyY, -0.2);
    between(chainR, tmpA, tmpB);
    const { mL, mR } = masses(p, sim.leon);
    const tilt = Math.max(-1, Math.min(1, (mR - mL) / 2));
    needle.rotation.z += (tilt * 1.0 - needle.rotation.z) * Math.min(1, dt * 4);
    (panelLamp.material as THREE.MeshBasicMaterial).color.setRGB(Math.sin(t * 5) > 0 ? 2.5 : 0.4, 0.1, 0.06);
    hatch.rotation.y += ((p.hatchOpen ? 1.45 : 0) - hatch.rotation.y) * Math.min(1, dt * 3);

    // Chase visuals
    const ch = sim.chase;
    alarmOn = p.alarm;
    for (const b of beacons) {
      b.visible = alarmOn;
      b.children[1].rotation.y = t * 4;
    }
    let warnAny = false;
    for (const gm of gateMeshes) {
      const gs = ch.gates.find((g) => g.id === gm.id)!;
      const h = Math.max(0.001, gm.top - gs.bottom);
      gm.panel.scale.y = h;
      gm.panel.position.y = gs.bottom + h / 2;
      const edge = gm.group.getObjectByName('edge')!;
      edge.position.set(gm.panel.position.x, gs.bottom + 0.07, -0.15);
      edge.visible = h > 0.05;
      const warn = gs.state === 'warn' || gs.state === 'closing';
      if (warn) warnAny = true;
      for (const l of gm.lamps) (l.material as THREE.MeshBasicMaterial).color.setRGB(warn && Math.sin(t * 14) > 0 ? 3 : 0.6, warn ? 0.9 : 0.4, 0.15);
      if (warn) gateLight.position.set(gm.panel.position.x - 0.6, gm.top + 0.2, 0.6);
    }
    gateWarnT = warnAny ? gateWarnT + dt : 0;
    gateLight.intensity = warnAny ? 26 * (0.5 + 0.5 * Math.sin(t * 14)) : 0;
    for (const fs of forecastStrips) {
      const gate = ch.gates.find((g) => g.lane === fs.lane)!;
      const active = gate.state === 'warn' || gate.state === 'closing';
      fs.mat.opacity = active ? 0.5 + 0.5 * Math.sin(t * 10) : ch.active ? 0.08 : 0;
    }
    // Monitors
    let lines = ['MONITORING', 'NO ANOMALIES'];
    let col = '#6ff3ff';
    if (ch.active) {
      lines = ['BREACH · WING B', 'MM-01 DISPATCHED'];
      col = '#ff8a6a';
      const g = ch.gates.find((gg) => gg.state !== 'open');
      if (g) {
        lines = [`ROUTE FORECAST: ${g.lane === 'catwalk' ? 'UPPER' : 'LOWER'} ${Math.round(ch.predicted.conf * 100)}%`, `SEALING ${g.id}`];
        col = '#6ff3ff';
      }
      if (ch.mode === 'passage') lines = ['INTERCEPT ROUTE', 'SERVICE PASSAGE · DOOR 3'];
      if (ch.mode === 'wait') lines = ['PREDICTED DESCENT', 'CATWALK END · HOLDING'];
      if (ch.subjectLost) {
        lines = ['SUBJECT LOST', 'NO SENSORS IN DUCT'];
        col = '#ffd27a';
      }
      if (ch.doorClosed) {
        lines = ['ARCHIVE BREACH CONFIRMED', 'SUBJECT IDENTITY PENDING'];
        col = '#ff8a6a';
      }
    }
    for (const m of monitors) m.set(lines, col);
    // Doors
    const entryOpen = ch.active && ch.mode !== 'inactive' ? 1 : ch.active && ch.enterT < 0.5 ? 1 : 0;
    entryDoor.open += (entryOpen - entryDoor.open) * Math.min(1, dt * 5);
    entryDoor.leaves.forEach((lf, i) => (lf.rotation.y = (i === 0 ? 1 : -1) * entryDoor.open * 1.3));
    const passageTele = ch.mode === 'passage' && ch.passageT > CHASE.passageDelay - 1.1;
    const passOpen = passageTele || (ch.mode === 'pursue' && ch.holdT > 0) ? 1 : 0;
    passageDoor.open += (passOpen - passageDoor.open) * Math.min(1, dt * 5);
    passageDoor.leaves.forEach((lf, i) => (lf.rotation.y = (i === 0 ? 1 : -1) * passageDoor.open * 1.3));
    (passageDoor.lamp.material as THREE.MeshBasicMaterial).color.setRGB(passageTele ? (Math.sin(t * 16) > 0 ? 3 : 0.5) : 0.4, passageTele ? 0.2 : 2.0, passageTele ? 0.1 : 2.2);
    (entryDoor.lamp.material as THREE.MeshBasicMaterial).color.setRGB(ch.active ? 2.6 : 0.4, ch.active ? 0.2 : 2.0, ch.active ? 0.1 : 2.2);
    // Terminal glass door drops when Leon is inside
    const gy = ch.doorClosed ? 0 : 3.2;
    glassDoor.position.y += (gy - glassDoor.position.y) * Math.min(1, dt * 7);
  });

  const update = (sim: Simulation, t: number, dt: number) => {
    for (const u of updaters) u(sim, t, dt);
  };

  const mmPose = (sim: Simulation) => {
    const ch = sim.chase;
    if (!ch.active) return null;
    const g = sim.guard;
    if (ch.mode === 'inactive') return { x: g.x, y: 0, z: -3.6, visible: ch.enterT < 0.6 };
    if (ch.mode === 'passage') return { x: g.x, y: 0, z: -2.9, visible: ch.passageT < 0.5 };
    if (ch.mode === 'stairs') {
      const k = Math.min(1, ch.stairT / CHASE.stairTime);
      const kk = ch.stairFrom === 'floor' ? k : 1 - k;
      const ang = kk * Math.PI * 2 * 1.25;
      return { x: g.x + Math.cos(ang) * 0.5, y: g.y, z: -2.3 + Math.sin(ang) * 0.5, visible: true };
    }
    const z = ch.lane === 'catwalk' ? -0.45 : ch.mode === 'done' ? -0.2 : -1.35;
    return { x: g.x, y: g.y, z, visible: true };
  };

  return { root, update, mmPose, occluders };
}
