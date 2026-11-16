/**
 * intro.js — the opening trailer that plays when the game starts.
 *
 * It uses the real game: a demo city is placed tile by tile on the live map,
 * so traffic, pedestrians, smoke and lit windows all come for free. The intro
 * only drives the camera, the time of day and the captions.
 *
 *   empty valley at dawn → the city is built → street-level fly-through
 *   → nightfall → title card with a Play button
 *
 * It can be skipped at any moment (button, click, Esc, Enter or Space) and is
 * left out entirely for players who ask their system for reduced motion. The
 * demo city stays behind the welcome screen and is cleared by the first level.
 */
import * as THREE from 'three';
import { GRID, CELL, DAY_SECONDS, DAY_START } from './constants.js';

const LAND = 14;                       // demo plot: four 2×2 blocks plus streets each way
const LO = (GRID - LAND) / 2;
const isStreet = (x, z) => (x - LO) % 3 === 2 || (z - LO) % 3 === 2;
const world = (gx, gz) => [(gx - GRID / 2 + 0.5) * CELL, (gz - GRID / 2 + 0.5) * CELL];

// District mixes: homes to the west, downtown in the middle, industry to the east
const MIX = {
  home: ['residential', 'residential', 'park', 'residential', 'residential', 'school', 'residential', 'residential'],
  town: ['commercial', 'commercial', 'residential', 'government', 'commercial', 'police', 'commercial', 'park', 'fire', 'commercial'],
  work: ['industrial', 'industrial', 'commercial', 'industrial', 'fire', 'industrial'],
};
const PLANTS = [[3, 3], [10, 3], [3, 10], [10, 10]].map(([x, z]) => `${LO + x},${LO + z}`);

/** Every tile of the demo city with the moment (seconds) it appears. */
function buildSchedule(t0, roadsFor, buildFor) {
  const c = GRID / 2 - 0.5, jobs = [];
  const count = { home: 0, town: 0, work: 0 };
  for (let x = LO; x < LO + LAND; x++) for (let z = LO; z < LO + LAND; z++) {
    const d = Math.hypot(x - c, z - c) / (LAND * 0.71);   // 0 at the centre, 1 in the corners
    if (isStreet(x, z)) { jobs.push({ x, z, type: 'road', at: t0 + d * roadsFor }); continue; }
    const plant = PLANTS.includes(`${x},${z}`);
    const u = (x - LO) / LAND;
    const zone = u < 0.42 ? 'home' : u < 0.72 ? 'town' : 'work';
    const type = plant ? 'power' : MIX[zone][count[zone]++ % MIX[zone].length];
    // Plants go up first so nothing flashes a "no power" badge
    const at = t0 + roadsFor + (plant ? 0 : 0.35 + d * buildFor + ((x * 7 + z * 13) % 5) * 0.06);
    jobs.push({ x, z, type, at, stage: type === 'residential' ? (x * 5 + z * 3) % 4 : 0 });
  }
  return jobs.sort((a, b) => a.at - b.at);
}

const ease = k => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
/** Seconds on the day clock that put the sun at day phase p (0 = sunrise). */
const clockFor = p => (((p - DAY_START) % 1 + 1) % 1) * DAY_SECONDS;

// One road through the middle of town for the street-level shot
const [, STREET_Z] = world(0, LO + 8);

/**
 * Shots: [start, end, camera(u), sun phase from → to, caption]
 * camera(u) returns [px, py, pz, tx, ty, tz] for u = 0–1 through the shot.
 */
const orbit = (a0, a1, r0, r1, h0, h1, ty = 0.4) => u => {
  const a = lerp(a0, a1, u), r = lerp(r0, r1, u);
  return [Math.cos(a) * r, lerp(h0, h1, u), Math.sin(a) * r, 0, ty, 0];
};
const SHOTS = [
  [0,    4.6, u => [lerp(15, 12, u), lerp(4.5, 6.5, u), lerp(18, 15, u), 0, 0.3, 0],           0.015, 0.07, 'It starts with an empty valley.'],
  [4.6, 12.2, orbit(0.95, 1.75, 21, 17, 13, 9.5),                                              0.07,  0.3,  'Lay roads. Power the grid. Zone the land.'],
  [12.2, 17,  u => [lerp(-8.5, 3.5, u), lerp(1.5, 1.05, u), STREET_Z + 0.32, lerp(-4, 9, u), 0.75, STREET_Z - 0.5], 0.3, 0.38, 'Watch your city come alive.'],
  [17,  22.6, orbit(2.5, 3.1, 14.5, 12.5, 7.5, 6, 0.8),                                        0.62,  0.8,  'From sunrise to city lights.'],
  [22.6, 1e9, orbit(3.1, 3.1 + 0.035 * 1e3, 12.5, 12.5, 6, 6, 0.8),                            0.8,   0.8,  null],
];
const TITLE_AT = 22.6, BUILD_AT = 4.9;

/**
 * api: { state, camera, controls, placeTile, restageHome, getTile, applyLand,
 *        frameLand, badgeLayer }
 * Returns { active, update(dt) }; onDone runs once when the intro ends.
 */
export function createIntro(api, onDone) {
  const { state, camera, controls } = api;
  const root = document.getElementById('intro');
  const caption = document.getElementById('intro-caption');
  const fade = document.getElementById('intro-fade');
  const intro = { active: false, update() {} };

  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    queueMicrotask(onDone);
    return intro;
  }

  // ── Stage the scene ──
  const saved = { money: state.money, month: state.month };
  state.land = LAND;
  state.money = 1e9;        // the demo city is on the house
  state.month = 5;          // midsummer: full green
  api.applyLand();
  controls.enabled = false;
  camera.layers.disable(api.badgeLayer);   // no floating signs in the trailer
  document.body.classList.add('intro');
  intro.active = true;

  const jobs = buildSchedule(BUILD_AT, 0.9, 5.2);
  let t = 0, next = 0, shot = -1, shownTitle = false;

  function finish() {
    if (!intro.active) return;
    intro.active = false;
    // Whatever is still unbuilt appears at once, so the backdrop is a whole city
    for (; next < jobs.length; next++) place(jobs[next]);
    state.money = saved.money;
    state.month = saved.month;
    state.dayClock = 0;
    controls.enabled = true;
    camera.layers.enable(api.badgeLayer);
    controls.target.set(0, 0, 0);
    api.frameLand(LAND);
    root.classList.add('leaving');
    document.body.classList.remove('intro');
    removeEventListener('keydown', onKey, true);
    setTimeout(() => { root.style.display = 'none'; }, 700);
    onDone();
  }

  function place(job) {
    api.placeTile(job.x, job.z, job.type, true);
    // Some homes have already grown into walk-ups and apartment blocks
    if (job.stage > 1) {
      const tile = api.getTile(job.x, job.z);
      if (tile) { tile.population = job.stage === 2 ? 9 : 15; api.restageHome(job.x, job.z, tile, job.stage - 1); }
    }
  }

  function onKey(e) {
    if (!['Escape', 'Enter', 'Space'].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    finish();
  }
  addEventListener('keydown', onKey, true);
  document.getElementById('intro-skip').addEventListener('click', finish);
  document.getElementById('intro-play').addEventListener('click', finish);

  function setCaption(text) {
    caption.classList.remove('show');
    if (!text) return;
    setTimeout(() => {
      if (!intro.active) return;
      caption.textContent = text;
      caption.classList.add('show');
    }, 350);
  }

  const pos = new THREE.Vector3();
  intro.update = dt => {
    if (!intro.active) return;
    t += Math.min(dt, 0.25);   // keeps roughly to time even on a slow machine

    // Build the city on schedule (a few tiles a frame at most, to keep it smooth)
    for (let n = 0; next < jobs.length && jobs[next].at <= t && n < 6; n++) place(jobs[next++]);

    // Current shot
    let i = SHOTS.findIndex(([a, b]) => t >= a && t < b);
    if (i < 0) i = SHOTS.length - 1;
    const [a, b, cam, p0, p1, text] = SHOTS[i];
    if (i !== shot) {
      shot = i;
      setCaption(text);
      if (i > 0) { fade.classList.remove('cut'); void fade.offsetWidth; fade.classList.add('cut'); } // dip to black on each cut
    }
    const span = Math.min(b - a, 1e3);
    const u = Math.min(1, (t - a) / span);
    const k = b > 1e8 ? (t - a) / 1e3 : ease(u);   // the title shot drifts on forever
    const [px, py, pz, tx, ty, tz] = cam(k);
    pos.set(px, py, pz);
    camera.position.copy(pos);
    controls.target.set(tx, ty, tz);
    camera.lookAt(tx, ty, tz);
    state.dayClock = clockFor(lerp(p0, p1, ease(u)));

    if (!shownTitle && t >= TITLE_AT + 0.4) { shownTitle = true; root.classList.add('title'); }
  };
  return intro;
}
