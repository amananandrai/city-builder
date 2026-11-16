/**
 * effects.js — transient visual feedback driven by simulation events:
 *   fires (flames, smoke, scorch mark), dust puffs, and floating numbers
 *   (DOM labels that track a world position or rise from a HUD element).
 */
import * as THREE from 'three';

const FLAME_GEO = new THREE.ConeGeometry(0.1, 0.36, 6);
const PUFF_GEO  = new THREE.IcosahedronGeometry(0.09, 1);
const SCORCH_GEO = new THREE.CircleGeometry(0.52, 20).rotateX(-Math.PI / 2);
const FLAME_COLORS = [0xff5a1f, 0xff8a1f, 0xffc93c];

export function createEffects({ scene, camera, renderer }) {
  const group = new THREE.Group();
  scene.add(group);
  const fires = [];
  const dusts = [];
  const floaters = [];

  const layer = document.createElement('div');
  layer.id = 'floaters';
  document.body.appendChild(layer);

  // ── Fire ─────────────────────────────────────────────────────────────────
  /**
   * Start a fire at a tile. height: top of the building. burnMonths: how long
   * the flames last in game time (shorter when a fire station responds).
   */
  function fire(pos, height = 0.6, burnMonths = 2) {
    const g = new THREE.Group();
    g.position.copy(pos);
    const flames = [];
    for (let i = 0; i < 10; i++) {
      // toneMapped off keeps the flames vivid in daylight and at night
      const mat = new THREE.MeshBasicMaterial({
        color: FLAME_COLORS[i % 3], transparent: true, opacity: 0.92,
        depthWrite: false, fog: false, toneMapped: false,
      });
      const m = new THREE.Mesh(FLAME_GEO, mat);
      // Half the flames burn on the roof, the rest lick up the outer walls
      const roof = i < 5;
      const a = Math.random() * Math.PI * 2;
      const rad = roof ? Math.random() * 0.22 : 0.36 + Math.random() * 0.06;
      const y = roof ? height * 0.92 : 0.08 + Math.random() * height * 0.7;
      m.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      g.add(m);
      flames.push({ m, y, phase: Math.random() * 10, size: (roof ? 1.1 : 0.8) + Math.random() * 0.8 });
    }
    const smokeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const puffs = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(PUFF_GEO, smokeMat);
      g.add(m);
      puffs.push({ m, phase: i / 7, dx: (Math.random() - 0.5) * 0.3 });
    }
    const scorch = new THREE.Mesh(SCORCH_GEO, new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: 0, depthWrite: false }));
    scorch.position.y = 0.045;
    scorch.renderOrder = 2;
    g.add(scorch);
    group.add(g);
    fires.push({ g, flames, puffs, smokeMat, scorch, height, age: 0, burn: burnMonths });
  }

  function updateFires(simMonths, t) {
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.age += simMonths;
      const burning = Math.max(0, Math.min(1, (f.burn - f.age) / 0.4)); // fades out at the end
      const smolder = Math.max(0, 1 - Math.max(0, f.age - f.burn) / 1.5);
      const linger  = Math.max(0, 1 - Math.max(0, f.age - f.burn - 1.5) / 4);
      for (const fl of f.flames) {
        const flick = 0.75 + 0.25 * Math.sin(t * 13 + fl.phase) + 0.15 * Math.sin(t * 31 + fl.phase * 2);
        const s = fl.size * flick * burning;
        fl.m.visible = s > 0.02;
        fl.m.scale.set(s, s * (1.1 + 0.3 * Math.sin(t * 9 + fl.phase)), s);
        fl.m.position.y = fl.y + 0.15 * s;
      }
      f.smokeMat.opacity = 0.55 * smolder;
      for (const p of f.puffs) {
        const k = (t * 0.35 + p.phase) % 1;
        p.m.visible = smolder > 0.02;
        p.m.position.set(p.dx + k * 0.35, f.height + 0.1 + k * 1.5, k * 0.15);
        p.m.scale.setScalar((0.6 + k * 2.2) * (k > 0.85 ? (1 - k) / 0.15 : 1));
      }
      f.scorch.material.opacity = 0.6 * Math.min(1, f.age / 0.5) * linger;
      if (linger <= 0) { disposeFire(f); fires.splice(i, 1); }
    }
  }

  function disposeFire(f) {
    group.remove(f.g);
    f.flames.forEach(fl => fl.m.material.dispose());
    f.smokeMat.dispose();
    f.scorch.material.dispose();
  }

  // ── Dust puff (construction) ─────────────────────────────────────────────
  const dustMat = new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false });
  function dust(pos) {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(PUFF_GEO, dustMat);
      const a = (i / 8) * Math.PI * 2;
      m.position.copy(pos);
      group.add(m);
      parts.push({ m, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9 });
    }
    dusts.push({ parts, age: 0, pos: pos.clone() });
  }

  function updateDust(dt) {
    for (let i = dusts.length - 1; i >= 0; i--) {
      const d = dusts[i];
      d.age += dt;
      const k = d.age / 0.7;
      if (k >= 1) { d.parts.forEach(p => group.remove(p.m)); dusts.splice(i, 1); continue; }
      const e = 1 - (1 - k) ** 2;
      for (const p of d.parts) {
        p.m.position.set(d.pos.x + p.vx * e * 0.55, 0.08 + e * 0.25, d.pos.z + p.vz * e * 0.55);
        p.m.scale.setScalar((0.5 + e * 1.4) * (1 - k * 0.6));
      }
    }
  }

  // ── Floating numbers ─────────────────────────────────────────────────────
  const LIFE = 1.9; // seconds
  /** Label that rises from a world position. cls: 'good' | 'bad' | 'info' */
  function floatText(pos, text, cls = 'good') {
    if (floaters.length > 24) return;
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    layer.appendChild(el);
    floaters.push({ el, pos: pos.clone(), age: 0 });
  }

  /** Label that rises from a HUD element (e.g. the cash counter). */
  function hudFloat(anchor, text, cls = 'good') {
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `floater hud ${cls}`;
    el.textContent = text;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.bottom + 4}px`;
    layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  const v = new THREE.Vector3();
  function updateFloaters(dt) {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      const k = f.age / LIFE;
      if (k >= 1) { f.el.remove(); floaters.splice(i, 1); continue; }
      v.copy(f.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h - k * 46;
      f.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      f.el.style.opacity = v.z > 1 ? 0 : k < 0.12 ? k / 0.12 : Math.min(1, (1 - k) / 0.35);
    }
  }

  return {
    fire, dust, floatText, hudFloat,
    /** dt: real seconds, simMonths: game time advanced this frame, t: clock */
    update(dt, simMonths, t) {
      updateFires(simMonths, t);
      updateDust(dt);
      updateFloaters(dt);
    },
    /** Hide/show screen-space labels (e.g. behind full-screen overlays). */
    setLabelsVisible(vis) { layer.style.display = vis ? '' : 'none'; },
    clear() {
      fires.forEach(disposeFire); fires.length = 0;
      dusts.forEach(d => d.parts.forEach(p => group.remove(p.m))); dusts.length = 0;
      floaters.forEach(f => f.el.remove()); floaters.length = 0;
    },
  };
}
