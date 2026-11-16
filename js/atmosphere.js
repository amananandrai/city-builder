/**
 * atmosphere.js — day/night cycle and seasons, driven by the game calendar.
 *
 *  Day/night: one full cycle every DAY_SECONDS of play (about a third
 *  of it is night). It runs on real play time, not the calendar, so a day
 *  lasts five minutes at every game speed.
 *
 *  `overcast` (0–1, from weather.js) dims the sun and greys the sky.
 *
 *  Seasons: Dec–Feb snow, Mar–May fresh growth, Sep–Nov autumn leaves.
 */
import * as THREE from 'three';
import { DAY_FRAC, dayPhase, MONTHS_PER_YEAR } from './constants.js';
import { setNight, setSeason } from './props.js';


// Sky gradient stops [top, middle, horizon]
const SKY = {
  day:   [0x3f87d6, 0x8cc4ef, 0xdcebf5],
  dusk:  [0x35407e, 0xe08f66, 0xffd3a1],
  night: [0x060a1a, 0x101a3a, 0x2a3760],
};
const SUN_DAY = new THREE.Color(0xfff1d6), SUN_LOW = new THREE.Color(0xffa25a), MOON = new THREE.Color(0xa9c0ff);
const HEMI_DAY = new THREE.Color(0xdcefff), HEMI_NIGHT = new THREE.Color(0x4c62a8);

// Per-month season strength (Jan = 0), interpolated through the month
const SNOW_M   = [1, 0.75, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.8];
const AUTUMN_M = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 0.8, 0.2];
const SPRING_M = [0, 0, 0.6, 1, 0.6, 0, 0, 0, 0, 0, 0, 0];

const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const mix = (arr, m) => { const i = Math.floor(m) % 12, f = m - Math.floor(m); return arr[i] + (arr[(i + 1) % 12] - arr[i]) * f; };

export function createAtmosphere({ scene, renderer, sun, hemi }) {
  const canvas = document.createElement('canvas');
  canvas.width = 2; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const skyTex = new THREE.CanvasTexture(canvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;

  const baseExposure = renderer.toneMappingExposure;
  const a = new THREE.Color(), b = new THREE.Color(), stops = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  let frame = 0;

  // The image-based light is the main ambient source, so it has to dim at
  // night too. three r160 has no scene-wide control, so set it per material;
  // the periodic re-apply catches buildings placed since the last change.
  let envK = 1, envFrame = 0;
  function setEnvironment(k) {
    if (Math.abs(k - envK) < 0.015 && envFrame++ % 45 !== 0) return;
    envK = k;
    scene.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m.envMapIntensity !== undefined) m.envMapIntensity = k;
    });
  }

  /**
   * dayClock: seconds of play since the level began; frac: 0–1 progress
   * through the current month; month: calendar month 0–11.
   */
  function update(dayClock, frac, month, overcast = 0) {
    // ── Day / night ────────────────────────────────────────────────────
    const p = dayPhase(dayClock);
    const isDay = p < DAY_FRAC;
    const u = isDay ? p / DAY_FRAC : (p - DAY_FRAC) / (1 - DAY_FRAC);
    const elev = Math.sin(Math.PI * u);                 // 0 at horizon, 1 at zenith
    const day = isDay ? smooth(0, 0.3, elev) : 0;       // 1 = full daylight
    const twilight = 4 * day * (1 - day);               // peaks at sunrise/sunset
    const night = 1 - day;

    // The one directional light is the sun by day and the moon by night; its
    // intensity passes through zero at the horizon so the swap is invisible.
    const az = Math.PI * (1 - u);
    const el = Math.max(0.16, elev) * 1.05;
    sun.position.set(Math.cos(az) * Math.cos(el) * 34, Math.sin(el) * 34, 12 + Math.sin(az) * 4);
    if (isDay) {
      sun.intensity = 2.2 * smooth(0, 0.3, elev);
      sun.color.copy(SUN_DAY).lerp(SUN_LOW, twilight * 0.85);
    } else {
      sun.intensity = 0.55 * smooth(0, 0.3, elev);
      sun.color.copy(MOON);
    }
    sun.intensity *= 1 - 0.55 * overcast; // cloud cover softens the sun
    hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, day);
    hemi.intensity = 0.42 - 0.07 * day;
    renderer.toneMappingExposure = baseExposure * (0.62 + 0.38 * day) * (1 - 0.22 * overcast);
    setNight(smooth(0.3, 0.8, night));
    setEnvironment(0.2 + 0.8 * day);

    // Sky + fog (canvas redraw is cheap but there's no need to do it every frame)
    if (frame++ % 4 === 0) {
      for (let i = 0; i < 3; i++) {
        stops[i].setHex(SKY.night[i]).lerp(a.setHex(SKY.day[i]), day).lerp(b.setHex(SKY.dusk[i]), twilight * 0.75)
          .lerp(a.setHex(0x8b96a3).multiplyScalar(0.25 + 0.75 * day), overcast * 0.7);
      }
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#' + stops[0].getHexString());
      g.addColorStop(0.55, '#' + stops[1].getHexString());
      g.addColorStop(1, '#' + stops[2].getHexString());
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
      skyTex.needsUpdate = true;
      scene.fog.color.copy(stops[2]).lerp(stops[1], 0.35);
    }

    // ── Seasons ────────────────────────────────────────────────────────
    const m = (month + frac + MONTHS_PER_YEAR - 0.5) % MONTHS_PER_YEAR; // table values sit mid-month
    setSeason({ snow: mix(SNOW_M, m), autumn: mix(AUTUMN_M, m), spring: mix(SPRING_M, m) });
  }

  return { update };
}
