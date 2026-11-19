import * as THREE from 'three';
import { Simulation, SIM_DT } from './sim/world';
import { HIDE_SPOTS, VAULT, FORECAST } from './sim/level';
import type { GuardMode, InputState } from './sim/types';
import { NO_INPUT } from './sim/types';
import { Assets, ALL_TEXTURES } from './render/assets';
import { buildHall } from './render/hall';
import { InspectorRig, LeonRig } from './render/characters';
import { CameraDirector } from './render/camera';
import { TechView } from './render/techView';
import { Post } from './render/post';
import { QUALITY, type QualityName } from './render/quality';
import { Input } from './input';
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
/** Photo mode for screenshots: cam=px,py,pz,tx,ty,tz[,fov] */
const camParam = params.get('cam')?.split(',').map(Number);

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
const sim = new Simulation({
  skipReveal: params.get('noreveal') === '1' || bench,
  godMode: bench || params.get('god') === '1',
  guardStart: params.get('gx') ? { x: Number(params.get('gx')), facing: (Number(params.get('gf') ?? -1) > 0 ? 1 : -1) as 1 | -1, patrolIndex: 0 } : undefined,
  spawn: spawnParam && spawnParam.length === 2 ? { x: spawnParam[0], y: spawnParam[1] } : undefined,
});
const leonRig = new LeonRig();
const guardRig = new InspectorRig(Q.eyeShadow);
const tech = new TechView();
let hall: ReturnType<typeof buildHall>;
let started = false;
let finishedShown = false;
const timings: Record<string, number> = {};

async function boot(): Promise<void> {
  const loadbar = $('loadbar').firstElementChild as HTMLElement;
  await assets.load(ALL_TEXTURES, Math.min(8, renderer.capabilities.getMaxAnisotropy()), (p) => (loadbar.style.width = `${Math.round(p * 100)}%`));
  timings.assetsLoaded = performance.now();
  hall = buildHall(assets, Q);
  scene.add(hall.root, leonRig.root, leonRig.scarfMesh, guardRig.root);
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
  };
  btn.onclick = () => start();
  document.querySelectorAll<HTMLButtonElement>('#qualityRow button').forEach((b) => {
    if (b.dataset.q === Q.name) b.classList.add('sel');
    b.onclick = () => switchQuality(b.dataset.q as QualityName);
  });
  if (autostart) start();
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
        break;
      case 'noise':
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
  if (l.x > VAULT.x - 0.4) {
    s.right = false;
    s.interact = Math.floor(sim.time * 4) % 2 === 0;
  }
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
    const inp = bench ? autopilot() : director.inCinematic ? NO_INPUT : input.state();
    if (director.inCinematic && input.anyKey) director.skipCinematic();
    acc += rawDt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 12) {
      // Benchmark runs with MM-01 perception disabled (godMode) so the route is deterministic.
      sim.step(inp);
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
    if ((sim.finished && benchT > 4) || benchT > 75) finishBench();
  }
}

function updateVisuals(dt: number, t: number): void {
  const l = sim.leon;
  const g = sim.guard;
  const hiddenIn = l.mode === 'hidden' || l.mode === 'enterHide' ? l.hideId : null;
  hall.update(t, dt, { leonX: l.x, leonY: l.y, camX: director.camera.position.x, camZ: director.camera.position.z, guardMode: g.mode, hiddenIn });
  guardRig.update(g, dt, t, director.camera.position);
  const threatActive = g.mode !== 'patrol' && Math.abs(g.x - l.x) < 12;
  leonRig.update(l, dt, t, { x: g.x, y: g.y, active: threatActive });
  const head = guardRig.head.getWorldPosition(new THREE.Vector3());
  const fwd = guardRig.head.getWorldDirection(new THREE.Vector3());
  director.update(dt, t, l, g, head, fwd, window.innerWidth / window.innerHeight);
  if (camParam && camParam.length >= 6) {
    director.camera.position.set(camParam[0], camParam[1], camParam[2]);
    director.camera.lookAt(camParam[3], camParam[4], camParam[5]);
    if (camParam[6]) {
      director.camera.fov = camParam[6];
      director.camera.updateProjectionMatrix();
    }
  }
  tech.update(sim);
  post.setFocus(director.camera.position.distanceTo(new THREE.Vector3(l.x, l.y + 1, 0)));
  post.setTension(Math.min(1, g.suspicion), l.mode === 'caught' ? Math.min(1, sim.caughtT / 0.8) : 0);
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
  if (techMode) {
    renderer.render(techScene, director.camera);
  } else {
    post.render(dt);
  }
}

// ------------------------------------------------------------------ HUD per frame
let ftDrawT = 0;
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
    else if (Math.abs(VAULT.x - l.x) <= VAULT.reach) prompt = '<kbd>E</kbd> otwórz Archiwum B-12';
    else if (l.x > -17.6 && l.x < -16.3 && !l.crouching) prompt = '<kbd>Ctrl</kbd> przeczołgaj się pod zaciętą kratą';
    else if (l.x > FORECAST.corridor.x0 && l.x < FORECAST.corridor.x0 + 1.5) prompt = '<span style="color:var(--cyan)">Cyjanowe światła: trasa przewidziana przez MIRROR</span>';
  } else if (l.mode === 'hidden') prompt = '<kbd>E</kbd> wyjdź z kryjówki';
  const pe = $('prompt');
  if (pe.innerHTML !== prompt) pe.innerHTML = prompt;
  pe.style.opacity = prompt ? '1' : '0';

  subtitleT -= dt;
  if (subtitleT <= 0) $('subtitle').style.opacity = '0';
  toastT -= dt;
  if (toastT <= 0) $('toast').style.opacity = '0';
  $('objective').style.opacity = director.inCinematic ? '0' : '1';

  if (sim.finished && !finishedShown && !bench) {
    finishedShown = true;
    setTimeout(() => {
      $('end').style.display = 'flex';
      $('endStats').innerHTML = `Czas: ${Math.round(sim.time)} s · złapania: ${sim.catches}<br>To jest koniec prototypu wizualno-rozgrywkowego.`;
      $('againBtn').onclick = () => location.reload();
      $('techBtn').onclick = () => {
        $('end').style.display = 'none';
        techMode = true;
        debugOn = true;
        applyView();
      };
    }, 2600);
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
    transferBytes: { js: sum((r) => r.name.endsWith('.js')), textures: sum((r) => r.name.includes('/tex/')), html: nav?.transferSize ?? 0 },
    completedRoute: sim.finished,
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
