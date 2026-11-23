import * as THREE from 'three';
import { Simulation, SIM_DT } from './sim/world';
import { HIDE_SPOTS, VAULT, FORECAST, PUZZLE, LEDGE_Y, TERMINAL, CHASE } from './sim/level';
import { Telemetry, applyTuning, type TelemetryReport } from './sim/telemetry';
import type { GuardMode, InputState } from './sim/types';
import { NO_INPUT } from './sim/types';
import { Assets, ALL_TEXTURES } from './render/assets';
import { buildHall } from './render/hall';
import { buildArchive } from './render/archive';
import { LightPool } from './render/lightPool';
import { OcclusionFader } from './render/occlusion';
import { laneOf } from './sim/chase';
import { leonInRightCage } from './sim/puzzle';
import { InspectorRig, LeonRig } from './render/characters';
import { GltfLeonRig, loadGLB } from './render/gltfCharacter';
import { GltfInspectorRig } from './render/gltfInspector';
import { CameraDirector } from './render/camera';
import { TechView } from './render/techView';
import { Post } from './render/post';
import { QUALITY, type QualityName } from './render/quality';
import { Input } from './input';
import { Terminal } from './replay/terminal';
import { scenarioFromId, storyScenario } from './replay/scenarios';
import { Audio } from './audio/audio';
import { FrameMetrics } from './metrics';

// ------------------------------------------------------------------ config from URL
const params = new URLSearchParams(location.search);
// Inside a hosted frame only a plain #name survives, so the main switches also accept a hash.
const hash = location.hash.slice(1);
const hashQ = hash in QUALITY ? (hash as QualityName) : null;
const qName = (params.get('q') as QualityName) || hashQ || (localStorageGet('mc.q') as QualityName) || 'medium';
const Q = QUALITY[qName] ?? QUALITY.medium;
let techMode = params.get('view') === 'tech' || hash === 'tech';
let debugOn = params.get('debug') === '1' || hash === 'debug' || techMode;
const bench = params.get('bench') === '1' || hash === 'bench';
const autostart = params.get('autostart') === '1' || bench;
const spawnParam = params.get('spawn')?.split(',').map(Number);
const freeze = params.get('freeze') === '1';
if (params.get('hud') === '0') document.body.classList.add('photo');
const openTerminalOnStart = params.get('terminal') === '1' || hash === 'terminal';
/** Training simulator straight from the URL: ?terminal=train or ?replay=<scenario-id> (does not start the story). */
const openTrainingOnStart = params.get('terminal') === 'train' || params.has('replay');
/** Photo mode for screenshots: cam=px,py,pz,tx,ty,tz[,fov] */
const camParam = params.get('cam')?.split(',').map(Number);
/** Photo mode that follows Leon: camFollow=dx,dy,dz,fov */
const camFollow = params.get('camFollow')?.split(',').map(Number);
/** Photo/inspection overrides, also scriptable at runtime through window.__mc.photo (tools/photo.mjs). */
const photo: { follow: number[] | null; cam: number[] | null; target: 'leon' | 'mm' } = { follow: camFollow ?? null, cam: null, target: 'leon' };

function localStorageGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function localStorageSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}

performance.mark('mc-script-start');

function switchQuality(q: QualityName): void {
  localStorageSet('mc.q', q);
  if (params.has('q')) {
    const u = new URL(location.href);
    u.searchParams.set('q', q);
    location.href = u.toString();
    return;
  }
  location.hash = q;
  location.reload();
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ renderer
const canvas = $<HTMLCanvasElement>('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const gl = renderer.getContext();
const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
renderer.shadowMap.enabled = Q.shadows || Q.eyeShadow;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, Q.pixelRatioCap) * Q.renderScale;
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x111827, 0.016);
const techScene = new THREE.Scene();
techScene.background = new THREE.Color(0x15171c);

const director = new CameraDirector(window.innerWidth / window.innerHeight);
const post = new Post(renderer, scene, director.camera, Q);

// ------------------------------------------------------------------ boot
const assets = new Assets();
const input = new Input();
const audio = new Audio();
const metrics = new FrameMetrics(600);
// Chase playtest knobs (?warn=0.8&mmspeed=4.8&gap=3&stepout=0.9&respawn=13&closed=6) — clamped, recorded in the report.
const tuning = applyTuning(params, CHASE as unknown as Record<string, unknown>);
const telemetry = new Telemetry({ build: 'M03', quality: Q.name, tuning });
const PLAYTEST_KEY = 'mc.playtests.v1';
function storedPlaytests(): TelemetryReport[] {
  try {
    return JSON.parse(localStorage.getItem(PLAYTEST_KEY) ?? '[]') as TelemetryReport[];
  } catch {
    return [];
  }
}
function savePlaytest(): void {
  try {
    const all = storedPlaytests().filter((r) => r.startedAt !== telemetry.report.startedAt);
    all.push(telemetry.report);
    localStorage.setItem(PLAYTEST_KEY, JSON.stringify(all.slice(-10)));
  } catch {
    /* private mode / quota: the report can still be copied or downloaded */
  }
}
let markerCount = -1;
const sim = new Simulation({
  skipReveal: params.get('noreveal') === '1' || bench,
  godMode: bench || params.get('god') === '1',
  startChase: params.get('chase') === '1' || hash === 'chase',
  puzzleSolved: params.get('solved') === '1',
  guardStart: params.get('gx') ? { x: Number(params.get('gx')), facing: (Number(params.get('gf') ?? -1) > 0 ? 1 : -1) as 1 | -1, patrolIndex: 0 } : undefined,
  spawn: spawnParam && spawnParam.length === 2 ? { x: spawnParam[0], y: spawnParam[1] } : undefined,
});
const proceduralLeon = new LeonRig();
let gltfLeon: GltfLeonRig | null = null;
/** Which Leon is shown: the skinned GLB from the Blender pipeline (default) or the procedural primitive rig. */
let useGltf = params.get('leon') !== 'procedural';
let leonRig: { root: THREE.Object3D; snap(): void; update: LeonRig['update'] } = proceduralLeon;
function applyLeonModel(): void {
  const g = useGltf && gltfLeon ? gltfLeon : null;
  leonRig = g ?? proceduralLeon;
  proceduralLeon.root.visible = !g;
  proceduralLeon.scarfMesh.visible = !g;
  if (gltfLeon) gltfLeon.root.visible = !!g;
  leonRig.snap();
  // MM-01 follows the same switch (GLB from the Blender pipeline vs procedural rig).
  const m = useGltfMM && gltfMM ? gltfMM : null;
  guardRig = m ?? proceduralMM;
  proceduralMM.root.visible = !m;
  if (gltfMM) gltfMM.root.visible = !!m;
  guardRig.setConeVisible(!techMode);
}
const proceduralMM = new InspectorRig(Q.eyeShadow);
let gltfMM: GltfInspectorRig | null = null;
let useGltfMM = params.get('mm') !== 'procedural';
let guardRig: InspectorRig | GltfInspectorRig = proceduralMM;
const tech = new TechView();
let hall: ReturnType<typeof buildHall>;
let archive: ReturnType<typeof buildArchive>;
const lightPool = new LightPool(scene, Q.name === 'low' ? 5 : 8);
const fader = new OcclusionFader();
let started = false;
let finishedShown = false;
const timings: Record<string, number> = {};

async function boot(): Promise<void> {
  const loadbar = $('loadbar').firstElementChild as HTMLElement;
  const glbT0 = performance.now();
  // ?leonModel=models/test/x.glb — A/B a candidate Leon (e.g. an AI-generated mesh after tools/blender/conform_character.py).
  const leonUrl = params.get('leonModel') && /^models\/[\w./-]+\.glb$/.test(params.get('leonModel')!) ? params.get('leonModel')! : 'models/leon.glb';
  const glbPromise = loadGLB(leonUrl)
    .then((g) => {
      timings.glbMs = performance.now() - glbT0;
      return g;
    })
    .catch((e) => {
      console.warn('GLB character failed to load, using procedural rig', e);
      return null;
    });
  const mmPromise = loadGLB('models/mm01.glb')
    .then((g) => {
      timings.mmGlbMs = performance.now() - glbT0;
      return g;
    })
    .catch((e) => {
      console.warn('MM-01 GLB failed to load, using procedural rig', e);
      return null;
    });
  await assets.load(ALL_TEXTURES, Math.min(8, renderer.capabilities.getMaxAnisotropy()), (p) => (loadbar.style.width = `${Math.round(p * 100)}%`));
  timings.assetsLoaded = performance.now();
  hall = buildHall(assets, Q, lightPool);
  archive = buildArchive(assets, lightPool);
  scene.add(hall.root, archive.root, proceduralLeon.root, proceduralLeon.scarfMesh, proceduralMM.root);
  const glb = await glbPromise;
  if (glb) {
    gltfLeon = new GltfLeonRig(glb, { fabric: Q.name !== 'low' });
    scene.add(gltfLeon.root);
    timings.glbTriangles = gltfLeon.stats.triangles;
  }
  const mmGlb = await mmPromise;
  if (mmGlb) {
    gltfMM = new GltfInspectorRig(mmGlb, { eyeShadow: Q.eyeShadow, fabric: Q.name !== 'low' });
    scene.add(gltfMM.root);
    timings.mmTriangles = gltfMM.stats.triangles;
  }
  applyLeonModel();
  for (const o of hall.occluders) fader.register(o);
  // Reflections from a tiny procedural environment (windows + lamps).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(hall.envScene, 0.03).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  techScene.add(tech.greybox);
  applyView();
  timings.sceneBuilt = performance.now();
  // Warm-up: compile shaders before the player can interact (avoids first-frame hitches).
  director.snap(sim.leon);
  updateVisuals(0, 0);
  await renderer.compileAsync(scene, director.camera);
  renderFrame(1 / 60);
  timings.firstFrame = performance.now();
  performance.mark('mc-first-frame');

  const btn = $<HTMLButtonElement>('startBtn');
  btn.disabled = false;
  btn.textContent = 'Rozpocznij';
  timings.interactive = performance.now();
  performance.mark('mc-interactive');
  let texBytes = 0;
  for (const t of assets.tex.values()) {
    const img = t.image as { width: number; height: number };
    texBytes += img.width * img.height * 4 * 1.33; // RGBA8 + mip chain
  }
  (window as unknown as Record<string, unknown>).__mc = {
    timings,
    sim: () => sim,
    metrics,
    renderer,
    quality: Q.name,
    isWebGL2,
    gpuTextureEstimateMB: +(texBytes / 1048576).toFixed(1),
    assetStats: assets.stats,
    photo,
  };
  btn.onclick = () => start();
  document.querySelectorAll<HTMLButtonElement>('#qualityRow button').forEach((b) => {
    if (b.dataset.q === Q.name) b.classList.add('sel');
    b.onclick = () => switchQuality(b.dataset.q as QualityName);
  });
  if (autostart) start();
  if (openTerminalOnStart) {
    start();
    openTerminal();
  }
  $('trainBtn').onclick = () => openTraining();
  if (openTrainingOnStart) openTraining(params.get('replay'));
  requestAnimationFrame(loop);
}

function start(): void {
  if (started) return;
  started = true;
  $('start').style.display = 'none';
  try {
    audio.start();
    audio.resume();
  } catch {
    /* audio optional */
  }
  if (!bench && params.get('nointro') !== '1' && !spawnParam) director.startIntro();
  setObjective('Wejdź do hali notowań i znajdź <b>Archiwum B-12</b>');
  timings.started = performance.now();
  metrics.reset();
}

// ------------------------------------------------------------------ Terminal B-12 (Market Replay)
let storyDone = false;
const terminal = new Terminal({
  onStoryComplete: () => {
    storyDone = true;
    sim.completeStory();
  },
  onClose: () => {
    $('hudRoot')?.classList.remove('dim');
  },
  onDecision: (d) => {
    (window as unknown as Record<string, unknown>).__replay = d;
    if (d.mode === 'story') telemetry.setTerminalDecision(d);
    else telemetry.addTraining(d);
  },
});
/** In-world terminal: Dave's session once per playthrough, the training simulator afterwards. */
function openTerminal(): void {
  if (terminal.isOpen) return;
  if (!storyDone) terminal.openStory(storyScenario());
  else terminal.openTraining();
}
/** Training simulator (menu / URL): never touches the story or Dave's recording. */
function openTraining(id?: string | null): void {
  if (terminal.isOpen) return;
  terminal.openTraining(id ? scenarioFromId(id) : null);
}
(window as unknown as Record<string, unknown>).__openTerminal = openTerminal;

// ------------------------------------------------------------------ HUD
let subtitleT = 0;
let toastT = 0;
function setObjective(html: string): void {
  $('objective').innerHTML = html;
}
function subtitle(who: string, text: string, dur = 3): void {
  const el = $('subtitle');
  el.innerHTML = `${who ? `<span class="who">${who}</span><br>` : ''}${text}`;
  el.style.opacity = '1';
  subtitleT = dur;
}
let hintT = 0;
let hintText = '';
function mirrorLine(text: string, dur: number): void {
  const el = $('mirror');
  el.textContent = `MIRROR · ${text}`;
  el.style.opacity = '1';
  mirrorT = dur;
}
let mirrorT = 0;
function toast(text: string): void {
  const el = $('toast');
  el.textContent = text;
  el.style.opacity = '1';
  toastT = 2.2;
}

function applyView(): void {
  if (tech.debug.parent) tech.debug.parent.remove(tech.debug);
  if (techMode) techScene.add(tech.debug);
  else if (debugOn) scene.add(tech.debug);
  guardRig.setConeVisible(!techMode);
  $('debug').style.display = debugOn ? 'block' : 'none';
  $('viewTag').textContent = `${techMode ? 'WARSTWA TECHNICZNA' : 'WARSTWA WIZUALNA'} · jakość: ${Q.name} · ${isWebGL2 ? 'WebGL 2' : 'WebGL 1'}${bench ? ' · BENCH' : ''}`;
}

// ------------------------------------------------------------------ events → audio/camera/HUD
const modeNames: Record<GuardMode, string> = { patrol: 'PATROL', suspicious: 'PODEJRZENIE', chase: 'POŚCIG', search: 'PRZESZUKANIE', return: 'POWRÓT' };
let guardStepAcc = 0;
function handleEvents(): void {
  const panOf = (x: number) => Math.max(-1, Math.min(1, (x - director.camera.position.x) / 10));
  for (const e of sim.events) {
    switch (e.type) {
      case 'step':
        if (e.who === 'leon') audio.leonStep(e.run, sim.leon.crouching, panOf(e.x));
        break;
      case 'land':
        audio.land(e.speed);
        if (e.speed > 8) director.addShake(0.35);
        break;
      case 'guardMode':
        if (e.to === 'suspicious') {
          audio.sting('suspicious');
          subtitle('MM-01', e.from === 'patrol' ? 'Unregistered movement detected.' : 'Recalibrating…', 2.6);
        } else if (e.to === 'chase') {
          audio.sting('chase');
          subtitle('MM-01', 'Subject acquired.', 2);
          director.addShake(0.3);
        } else if (e.to === 'search') {
          audio.sting('search');
          subtitle('MM-01', 'Visual lost. Consulting MIRROR forecast.', 3);
        } else if (e.to === 'return') audio.sting('calm');
        break;
      case 'caught':
        audio.sting('caught');
        director.startCaught();
        subtitle('MM-01', e.reason === 'found' ? 'Forecast confirmed.' : 'Hold still.', 2);
        break;
      case 'respawn':
        leonRig.snap();
        director.snap(sim.leon);
        toast('PUNKT KONTROLNY');
        break;
      case 'checkpoint':
        audio.sting('checkpoint');
        toast('PUNKT KONTROLNY ZAPISANY');
        break;
      case 'hide':
        audio.sting('hide');
        break;
      case 'unhide':
        audio.sting('hide');
        break;
      case 'reveal':
        audio.sting('reveal');
        director.startReveal();
        break;
      case 'finished':
        audio.sting('finish');
        director.startFinale();
        setObjective('');
        setTimeout(() => subtitle('MM-01', 'Archive breach confirmed. Subject identity pending.', 5), 1800);
        break;
      case 'noise':
        break;
      case 'sealed':
        subtitle('LEON', 'Zaplombowane… MIRROR zamknął to od środka. Musi być inna droga.', 3.6);
        break;
      case 'lever':
        audio.clank();
        if (e.result === 'tooLight') {
          subtitle(
            'LEON',
            sim.puzzle.tooLightCount > 1 ? 'Ten wózek z aktami… jest cięższy ode mnie.' : 'Za lekko. Po drugiej stronie musi być coś cięższego.',
            3.4,
          );
        }
        break;
      case 'cartLocked':
        audio.clank();
        subtitle('LEON', 'Jest. Teraz druga klatka.', 2.4);
        break;
      case 'cageStop':
        audio.slam();
        if (e.cage === 'R') subtitle('LEON', 'Trzecia droga.', 2.2);
        break;
      case 'push':
        if (Math.random() < 0.08) audio.rumble();
        break;
      case 'slide':
        audio.whoosh();
        break;
      case 'alarm':
        audio.setAlarm(true);
        audio.sting('chase');
        director.addShake(0.5);
        subtitle('MM-01', 'Breach in archive wing B. Engaging.', 3);
        setObjective('Uciekaj do <b>pokoju terminala B-12</b>');
        break;
      case 'mmEnter':
        audio.slam();
        audio.sting('suspicious');
        director.addShake(0.25);
        break;
      case 'gateWarn':
        audio.mirrorBlip();
        mirrorLine(`PROGNOZA TRASY: ${e.lane === 'catwalk' ? 'GÓRNA' : 'DOLNA'} ${Math.round(e.confidence * 100)}% → ZAMYKANIE ${e.gate}`, 3.2);
        hintT = 3.2;
        hintText = e.lane === 'catwalk' ? 'Zeskocz z pomostu: <kbd>S</kbd> + <kbd>Spacja</kbd>' : 'Wespnij się na regał (<kbd>Spacja</kbd>) albo ślizg pod bramą: <kbd>Ctrl</kbd> w biegu';
        break;
      case 'gateClosed':
        audio.slam();
        director.addShake(0.2);
        break;
      case 'intercept':
        audio.mirrorBlip();
        mirrorLine(e.kind === 'passage' ? 'PRZECHWYCENIE: KORYTARZ SERWISOWY · DRZWI 3' : 'PRZEWIDYWANE ZEJŚCIE: KONIEC POMOSTU', 3);
        break;
      case 'mmStairs':
        audio.clank();
        break;
      case 'subjectLost':
        audio.sting('calm');
        mirrorLine('UTRATA CELU — BRAK CZUJNIKÓW W KANALE', 3);
        break;
      case 'doorClosed':
        audio.slam();
        audio.setAlarm(false);
        subtitle('LEON', 'Zablokowane od środka. Stary pokój — MIRROR go nie widzi. Mam chwilę.', 3.6);
        setObjective('Uruchom <b>Terminal B-12</b>');
        break;
      case 'terminal':
        openTerminal();
        break;
      default:
        break;
    }
  }
}

// ------------------------------------------------------------------ bench autopilot
let benchT = 0;
let stuckT = 0;
let lastX = 0;
function autopilot(): InputState {
  const l = sim.leon;
  const s: InputState = { ...NO_INPUT, right: true };
  if (l.x > -17.4 && l.x < -15.3) s.crouch = true;
  if (Math.abs(l.x - lastX) < 0.002 && l.grounded) stuckT += SIM_DT;
  else stuckT = 0;
  lastX = l.x;
  if (stuckT > 0.08) s.jump = Math.floor(sim.time * 8) % 2 === 0;
  if (!sim.chase.active && l.x > 23.6 && l.grounded) {
    // Benchmark covers rendering of both areas; the puzzle itself is verified by tests.
    sim.debugStartChase(46.4, 0);
  }
  if (sim.chase.active) s.run = true;
  return s;
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let acc = 0;
let simTime = 0;
let prevGuardMode: GuardMode = 'patrol';
function loop(now: number): void {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.1, (now - last) / 1000);
  const frameMs = now - last;
  last = now;
  if (started) metrics.push(frameMs);

  // UI toggles
  if (input.wasPressed('KeyT')) {
    techMode = !techMode;
    debugOn = techMode || debugOn;
    applyView();
  }
  if (input.wasPressed('KeyG') && (gltfLeon || gltfMM)) {
    useGltf = !useGltf;
    useGltfMM = useGltf;
    applyLeonModel();
    toast(useGltf ? 'POSTACIE: MODELE GLB (BLENDER, SKINNING)' : 'POSTACIE: RIGI PROCEDURALNE (M01)');
  }
  if (input.wasPressed('F1') || input.wasPressed('Backquote')) {
    debugOn = !debugOn;
    applyView();
  }
  for (const [code, q] of [
    ['Digit1', 'low'],
    ['Digit2', 'medium'],
    ['Digit3', 'high'],
  ] as const) {
    if (input.wasPressed(code) && q !== Q.name) switchQuality(q);
  }
  if (started && !freeze) {
    const inp = bench ? autopilot() : director.inCinematic || terminal.isOpen ? NO_INPUT : input.state();
    if (director.inCinematic && input.anyKey) director.skipCinematic();
    acc += rawDt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 12) {
      // Benchmark runs with MM-01 perception disabled (godMode) so the route is deterministic.
      sim.step(inp);
      if (!bench) telemetry.step(sim, SIM_DT);
      handleEvents();
      acc -= SIM_DT;
      simTime += SIM_DT;
      steps++;
    }
    if (steps === 12) acc = 0;
  }
  updateVisuals(rawDt, simTime);
  renderFrame(rawDt);
  updateHud(rawDt);
  input.endFrame();

  if (bench && started) {
    benchT += rawDt;
    // The rendering route ends in the safe room (door sealed); the story itself then continues in Terminal B-12.
    if (((sim.finished || sim.chase.doorClosed) && benchT > 4) || benchT > 75) finishBench();
  }
}

function updateVisuals(dt: number, t: number): void {
  const l = sim.leon;
  const g = sim.guard;
  const hiddenIn = l.mode === 'hidden' || l.mode === 'enterHide' ? l.hideId : null;
  hall.update(t, dt, { leonX: l.x, leonY: l.y, camX: director.camera.position.x, camZ: director.camera.position.z, guardMode: g.mode, hiddenIn });
  archive.update(sim, t, dt);
  if (guardRig instanceof GltfInspectorRig) guardRig.grabbing = l.mode === 'caught';
  guardRig.update(g, dt, t, director.camera.position, archive.mmPose(sim));
  const threatActive = (g.mode !== 'patrol' && Math.abs(g.x - l.x) < 12) || (sim.chase.active && sim.chase.mode !== 'inactive' && sim.chase.mode !== 'passage');
  leonRig.update(l, dt, t, { x: g.x, y: g.y, active: threatActive });
  const head = guardRig.head.getWorldPosition(new THREE.Vector3());
  const fwd = guardRig.head.getWorldDirection(new THREE.Vector3());
  director.update(dt, t, l, g, head, fwd, window.innerWidth / window.innerHeight);
  const pf = photo.follow;
  if (pf && pf.length >= 3) {
    const mm = photo.target === 'mm';
    const tx = mm ? guardRig.root.position.x : l.x;
    const ty = mm ? guardRig.root.position.y : l.y;
    const tz = mm ? guardRig.root.position.z : 0;
    director.camera.position.set(tx + pf[0], ty + pf[1], tz + pf[2]);
    director.camera.lookAt(tx, ty + (pf[4] ?? 0.9), tz);
    if (pf[3]) {
      director.camera.fov = pf[3];
      director.camera.updateProjectionMatrix();
    }
  }
  const pc = photo.cam ?? camParam;
  if (pc && pc.length >= 6) {
    director.camera.position.set(pc[0], pc[1], pc[2]);
    director.camera.lookAt(pc[3], pc[4], pc[5]);
    if (pc[6]) {
      director.camera.fov = pc[6];
      director.camera.updateProjectionMatrix();
    }
  }
  tech.update(sim);
  if (techMode && markerCount !== telemetry.report.catches.length) {
    markerCount = telemetry.report.catches.length;
    const old = storedPlaytests()
      .filter((r) => r.startedAt !== telemetry.report.startedAt)
      .flatMap((r) => r.catches.map((c) => ({ x: c.x, y: c.y, old: true })));
    tech.setMarkers([...old, ...telemetry.report.catches.map((c) => ({ x: c.x, y: c.y }))]);
  }
  lightPool.update(new THREE.Vector3(l.x, l.y + 1.5, 0), t);
  fader.update(director.camera, [new THREE.Vector3(l.x, l.y + l.height * 0.85, 0), new THREE.Vector3(l.x, l.y + l.height * 0.4, 0)], dt);
  if (sim.puzzle.moving !== 0) audio.creak(dt);
  post.setFocus(director.camera.position.distanceTo(new THREE.Vector3(l.x, l.y + 1, 0)));
  const chaseTension = sim.chase.active && !sim.chase.doorClosed && sim.chase.mode !== 'inactive' ? Math.max(0, 1 - Math.abs(g.x - l.x) / 10) * 0.8 : 0;
  post.setTension(Math.min(1, Math.max(g.suspicion * (sim.chase.active ? 0 : 1), chaseTension)), l.mode === 'caught' ? Math.min(1, sim.caughtT / 0.8) : 0);
  // MM-01 footsteps audio
  if (g.speed > 0.05) {
    guardStepAcc += dt * (g.mode === 'chase' ? 3.6 : 1.5);
    if (guardStepAcc > 1) {
      guardStepAcc = 0;
      audio.guardStep(Math.abs(g.x - l.x), Math.max(-1, Math.min(1, (g.x - director.camera.position.x) / 10)));
    }
  }
  audio.update(dt, g.suspicion, g.mode === 'chase');
  if (g.mode !== prevGuardMode) prevGuardMode = g.mode;
}

function renderFrame(dt: number): void {
  renderer.info.reset();
  // The terminal covers the screen: skip the 3D frame (saves GPU/battery on laptops and phones).
  if (terminal.isOpen) return;
  if (techMode) {
    renderer.render(techScene, director.camera);
  } else {
    post.render(dt);
  }
}

// ------------------------------------------------------------------ HUD per frame
let ftDrawT = 0;
let corridorObjective = false;
function updateHud(dt: number): void {
  const l = sim.leon;
  const g = sim.guard;
  // Letterbox + fade
  const lb = director.letterbox;
  $('letterTop').style.transform = `scaleY(${lb})`;
  $('letterBot').style.transform = `scaleY(${lb})`;
  const fade = l.mode === 'caught' ? Math.max(0, (sim.caughtT - 0.9) / 0.6) : 0;
  $('fade').style.opacity = String(Math.min(1, fade));

  // Context prompts
  let prompt = '';
  if (started && l.mode === 'normal' && l.grounded && !director.inCinematic) {
    const spot = HIDE_SPOTS.find((h) => Math.abs(h.x - l.x) <= h.reach && Math.abs(h.y - l.y) < 0.4);
    if (spot) prompt = `<kbd>E</kbd> schowaj się — ${spot.label}${spot.forecast ? ' · <span style="color:var(--cyan)">MIRROR przewiduje to miejsce</span>' : ''}`;
    else if (Math.abs(VAULT.x - l.x) <= VAULT.reach && l.y < 0.5) prompt = '<kbd>E</kbd> sprawdź sejf B-12';
    else if (leonInRightCage(sim.puzzle, l) && !sim.puzzle.solved) prompt = '<kbd>E</kbd> dźwignia hamulca windy';
    else if (!sim.puzzle.alarm && Math.abs(l.x - PUZZLE.panel.x) <= PUZZLE.panel.reach && Math.abs(l.y - LEDGE_Y) < 0.1)
      prompt = '<kbd>E</kbd> awaryjne otwarcie włazu · <span style="color:#ff7a5a">URUCHOMI ALARM</span>';
    else if (l.pushing) prompt = 'Pchasz wózek z aktami (240 kg)';
    else if (l.x > 80.0 && l.x < 81.2 && l.y > -0.2 && l.y < 0.3) prompt = '<kbd>S</kbd> + <kbd>Spacja</kbd> zejdź do kanału serwisowego';
    else if (laneOf(l) === 'tunnel') prompt = 'Kanał serwisowy — czołgasz się';
    else if (sim.chase.doorClosed && !sim.finished && Math.abs(TERMINAL.x - l.x) <= TERMINAL.reach) prompt = '<kbd>E</kbd> uruchom Terminal B-12';
    else if (hintT > 0) prompt = hintText;
    else if (l.x > -17.6 && l.x < -16.3 && !l.crouching) prompt = '<kbd>Ctrl</kbd> przeczołgaj się pod zaciętą kratą';
    else if (l.x > FORECAST.corridor.x0 && l.x < FORECAST.corridor.x0 + 1.5) prompt = '<span style="color:var(--cyan)">Cyjanowe światła: trasa przewidziana przez MIRROR</span>';
  } else if (l.mode === 'hidden') prompt = '<kbd>E</kbd> wyjdź z kryjówki';
  const pe = $('prompt');
  if (pe.innerHTML !== prompt) pe.innerHTML = prompt;
  pe.style.opacity = prompt ? '1' : '0';

  subtitleT -= dt;
  if (subtitleT <= 0) $('subtitle').style.opacity = '0';
  hintT -= dt;
  mirrorT -= dt;
  if (mirrorT <= 0) $('mirror').style.opacity = '0';
  if (!sim.chase.active && !sim.puzzle.solved && l.x > 24.5 && !corridorObjective) {
    corridorObjective = true;
    setObjective('Dostań się do <b>Archiwum B-12</b>');
  }
  toastT -= dt;
  if (toastT <= 0) $('toast').style.opacity = '0';
  $('objective').style.opacity = director.inCinematic ? '0' : '1';

  if (sim.finished && !finishedShown && !bench) {
    finishedShown = true;
    setTimeout(() => {
      $('end').style.display = 'flex';
      $('endStats').innerHTML = `Czas: ${Math.round(sim.time)} s · złapania: ${sim.catches}<br>The Last Shift — koniec rozdziału. Następnie: <b>The Paper District</b>.`;
      savePlaytest();
      showPlaytestPanel();
      $('againBtn').onclick = () => location.reload();
      $('techBtn').onclick = () => {
        $('end').style.display = 'none';
        techMode = true;
        debugOn = true;
        applyView();
      };
    }, 6500);
  }

  if (debugOn) {
    ftDrawT -= dt;
    if (ftDrawT <= 0) {
      ftDrawT = 0.25;
      const s = metrics.stats();
      const info = renderer.info;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const lines = [
        `FPS ${s.fps.toFixed(0)}  avg ${s.avg.toFixed(1)}ms  p95 ${s.p95.toFixed(1)}  p99 ${s.p99.toFixed(1)}`,
        `long(>33ms) ${metrics.long}/${metrics.total}`,
        `draw ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k  tex ${info.memory.textures}  geo ${info.memory.geometries}`,
        mem ? `JS heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'JS heap n/a (Chromium only)',
        `shot ${director.shotId}  q=${Q.name}`,
        ``,
        `LEON  x ${l.x.toFixed(1)} y ${l.y.toFixed(1)}  ${l.mode}${l.crouching ? ' crouch' : ''}`,
        `światło ${(l.light * 100).toFixed(0)}%  ekspozycja ${(l.exposure * 100).toFixed(0)}%`,
        `MM-01 ${modeNames[g.mode]}  zasięg ${g.sight.range.toFixed(1)}m`,
        `podejrzenie ${(Math.min(1, g.suspicion) * 100).toFixed(0)}%  ${g.sight.visible ? 'WIDZI' : 'nie widzi'}`,
        `ostatnia znana ${g.lastKnown ? g.lastKnown.x.toFixed(1) : '—'}  checkpoint ${sim.checkpoint.id}`,
        `playtest: złapania ${telemetry.report.catches.length}  tuning ${Object.keys(tuning).length ? JSON.stringify(tuning) : 'domyślny'}`,
      ];
      $('debugText').textContent = lines.join('\n');
      metrics.draw($<HTMLCanvasElement>('ftGraph'));
    }
  }
}

function finishBench(): void {
  if ((window as unknown as Record<string, unknown>).__bench) return;
  const s = metrics.stats();
  const info = renderer.info;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const sum = (f: (r: PerformanceResourceTiming) => boolean) => res.filter(f).reduce((a, r) => a + (r.transferSize || 0), 0);
  const report = {
    quality: Q.name,
    webgl2: isWebGL2,
    gpu: (() => {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
    })(),
    viewport: `${window.innerWidth}x${window.innerHeight}@${pixelRatio().toFixed(2)}`,
    frames: s.n,
    fps: +s.fps.toFixed(1),
    frameMs: { avg: +s.avg.toFixed(2), p50: +s.p50.toFixed(2), p95: +s.p95.toFixed(2), p99: +s.p99.toFixed(2), max: +s.max.toFixed(2) },
    longFramesOver33ms: metrics.long,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    gpuTextures: info.memory.textures,
    gpuGeometries: info.memory.geometries,
    jsHeapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
    timeToInteractiveMs: Math.round(timings.interactive),
    firstFrameMs: Math.round(timings.firstFrame),
    transferBytes: { js: sum((r) => r.name.endsWith('.js')), textures: sum((r) => r.name.includes('/tex/')), models: sum((r) => r.name.includes('/models/')), html: nav?.transferSize ?? 0 },
    lightPool: lightPool.lights.length,
    leonModel: useGltf && gltfLeon ? 'glb' : 'procedural',
    completedRoute: sim.finished || sim.chase.doorClosed,
  };
  (window as unknown as Record<string, unknown>).__bench = report;
  $('end').style.display = 'flex';
  $('endStats').innerHTML = 'Benchmark zakończony. Skopiuj wynik:';
  const out = $('benchOut');
  out.style.display = 'block';
  out.textContent = JSON.stringify(report, null, 2);
  console.log('[bench]', JSON.stringify(report));
}

window.addEventListener('resize', () => {
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  post.setSize(window.innerWidth, window.innerHeight);
});

boot().catch((e) => {
  console.error(e);
  $('startBtn').textContent = 'Błąd ładowania — szczegóły w konsoli';
});

// ------------------------------------------------------------------ playtest panel (end card)
const RATING_QUESTIONS: [string, string][] = [
  ['tension', 'Napięcie w pościgu'],
  ['fair', 'Uczciwość złapań (czy wiedziałeś, co poszło źle?)'],
  ['mirror', 'Czytelność ostrzeżeń MIRROR'],
  ['puzzle', 'Zagadka „Waga archiwisty”'],
  ['terminal', 'Terminal B-12 / Market Replay'],
  ['characters', 'Postacie (Leon, MM-01)'],
];
function showPlaytestPanel(): void {
  const host = $('playtest');
  host.style.display = 'block';
  const rows = RATING_QUESTIONS.map(
    ([k, label]) =>
      `<div class="pt-q"><span>${label}</span><span class="pt-r" data-q="${k}">${[1, 2, 3, 4, 5].map((v) => `<button data-v="${v}">${v}</button>`).join('')}</span></div>`,
  ).join('');
  host.innerHTML = `<div class="pt-sum">${telemetry.summary().replace(/\n/g, '<br>')}</div>${rows}
    <textarea id="ptNotes" placeholder="Uwagi (opcjonalnie): co frustrowało, co zaskoczyło?" rows="2"></textarea>
    <div class="row"><button id="ptCopy">Kopiuj raport</button><button id="ptSave">Pobierz JSON</button></div>
    <div id="ptMsg" class="pt-msg">Raport zostaje lokalnie w tej przeglądarce (ostatnie 10 sesji). Nic nie jest wysyłane.</div>`;
  host.querySelectorAll<HTMLElement>('.pt-r').forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.onclick = () => {
        telemetry.rate(row.dataset.q!, Number(b.dataset.v));
        row.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', Number((x as HTMLButtonElement).dataset.v) <= Number(b.dataset.v)));
        savePlaytest();
      };
    });
  });
  const notes = $<HTMLTextAreaElement>('ptNotes');
  notes.oninput = () => {
    telemetry.setNotes(notes.value);
    savePlaytest();
  };
  const text = () => `MARGIN CITY playtest ${telemetry.report.startedAt}\n${telemetry.summary()}\n\n${telemetry.toJSON()}`;
  $('ptCopy').onclick = async () => {
    const msg = $('ptMsg');
    try {
      await navigator.clipboard.writeText(text());
      msg.textContent = 'Skopiowano do schowka.';
    } catch {
      // Fallback for contexts without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text();
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      msg.textContent = ok ? 'Skopiowano do schowka.' : 'Nie udało się skopiować — użyj „Pobierz JSON”.';
    }
  };
  $('ptSave').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([telemetry.toJSON()], { type: 'application/json' }));
    a.download = `margin-city-playtest-${telemetry.report.startedAt.replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
}
(window as unknown as Record<string, unknown>).__telemetry = telemetry;
