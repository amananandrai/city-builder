/**
 * weather.js — rain and snowfall. Purely visual: the weather is re-rolled each
 * month (snow in winter, rain mostly in spring and autumn) and fades in/out.
 * `overcast` (0–1) lets the atmosphere dim the sun and grey the sky.
 */
import * as THREE from 'three';

const COUNT = 1400;
const BOX = { x: 34, y: 16, z: 34 }; // volume of falling particles, centred on the view target

function particleTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  if (kind === 'snow') {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  } else {
    // Thin, slightly slanted streak
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(235,242,250,0)'); g.addColorStop(1, 'rgba(235,242,250,1)');
    ctx.strokeStyle = g; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(18, 1); ctx.lineTo(14, 31); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

const LOOK = {
  snow: { size: 0.16, speed: 1.5, opacity: 0.9, overcast: 0.55 },
  rain: { size: 0.7, speed: 15,  opacity: 0.85, overcast: 1 },
};

export function createWeather({ scene, controls }) {
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * BOX.x;
    pos[i * 3 + 1] = Math.random() * BOX.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = { snow: particleTexture('snow'), rain: particleTexture('rain') };
  const mat = new THREE.PointsMaterial({ map: tex.snow, size: 0.16, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  let kind = 'clear';   // what the sky is doing this month
  let shown = 'snow';   // particle look in use (kept while fading out)
  let amount = 0;       // 0–1 fade
  let t = 0;

  function setKind(k) {
    kind = k;
    if (k !== 'clear' && amount < 0.05) {
      shown = k;
      mat.map = tex[k]; mat.size = LOOK[k].size; mat.needsUpdate = true;
    }
  }

  return {
    /** Pick this month's weather. month: 0–11 */
    roll(month) {
      const r = Math.random();
      if (month === 11 || month <= 1) setKind(r < 0.45 ? 'snow' : 'clear');
      else setKind(r < ([2, 3, 4, 8, 9, 10].includes(month) ? 0.3 : 0.14) ? 'rain' : 'clear');
    },
    clear() { kind = 'clear'; amount = 0; points.visible = false; },
    get kind() { return kind; },
    /** 0 = clear sky, 1 = heavy cloud */
    get overcast() { return amount * LOOK[shown].overcast; },
    update(dt) {
      // Fade toward the current weather; a different kind waits for the old one to clear
      const want = kind === shown ? 1 : 0;
      amount += Math.max(-dt * 0.6, Math.min(dt * 0.6, want - amount));
      if (amount < 0.02 && kind !== 'clear' && kind !== shown) setKind(kind);
      points.visible = amount > 0.02;
      if (!points.visible) return;
      t += dt;
      const look = LOOK[shown];
      mat.opacity = look.opacity * amount;
      const snow = shown === 'snow';
      for (let i = 0; i < COUNT; i++) {
        const j = i * 3;
        pos[j + 1] -= look.speed * dt * (0.7 + (i % 7) * 0.08);
        if (snow) pos[j] += Math.sin(t * 0.9 + i) * dt * 0.35;
        else pos[j] -= dt * 1.6;
        if (pos[j + 1] < 0) { pos[j + 1] += BOX.y; pos[j] = (Math.random() - 0.5) * BOX.x; }
      }
      geo.attributes.position.needsUpdate = true;
      points.position.set(controls.target.x, 0, controls.target.z);
    },
  };
}
