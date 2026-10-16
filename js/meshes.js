/**
 * meshes.js
 * Builds tile meshes. Uses Kenney GLB models for all zone buildings.
 * Road and Power Plant use procedural geometry (no Kenney equivalent).
 * Police and Fire Station also use procedural geometry for visual clarity.
 */
import * as THREE from 'three';
import { CELL, ZONE_DEF } from './constants.js';
import { cloneModel, modelConfig } from './assets.js';

// ── Material cache ─────────────────────────────────────────────────────────
const matCache = {};
export function getMat(color, emissive = 0) {
  const key = `${color}_${emissive}`;
  if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial({ color, emissive });
  return matCache[key];
}

// ── Main entry point ───────────────────────────────────────────────────────
export function buildTileMesh(type) {
  const group = new THREE.Group();

  // ── Road ──────────────────────────────────────────────────────────────
  if (type === 'road') {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.98, 0.06, CELL * 0.98), getMat(0x4a4a4a));
    slab.position.y = 0.03;
    slab.receiveShadow = true;
    group.add(slab);
    // Centre dashes
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.05, 0.07, CELL * 0.42), getMat(0xffd700));
    dash.position.y = 0.04;
    group.add(dash);
    // Side kerbs
    for (const side of [-1, 1]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, CELL * 0.98), getMat(0x888888));
      kerb.position.set(side * CELL * 0.46, 0.04, 0);
      group.add(kerb);
    }
    return group;
  }

  // ── Power Plant ────────────────────────────────────────────────────────
  if (type === 'power') {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.82, 0.22, CELL * 0.82), getMat(0x7f8c8d));
    base.position.y = 0.11;
    base.castShadow = true;
    group.add(base);
    for (let i = 0; i < 2; i++) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5), getMat(0xaaaaaa));
      ch.position.set(i === 0 ? -0.22 : 0.22, 0.97, 0);
      ch.castShadow = true;
      group.add(ch);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), getMat(0xdddddd, 0x555555));
      puff.position.set(i === 0 ? -0.22 : 0.22, 1.78, 0);
      group.add(puff);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.045, 8, 24), getMat(0xf1c40f, 0xf1c40f));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.24;
    group.add(ring);
    return group;
  }

  // ── Police Station ─────────────────────────────────────────────────────
  if (type === 'police') {
    const w2 = CELL * 0.72, h2 = 0.95;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, w2 * 0.85), getMat(0x1a5276));
    body.position.y = h2 / 2; body.castShadow = true; group.add(body);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.06, 0.07, w2 * 0.85 + 0.06), getMat(0x154360));
    parapet.position.y = h2 + 0.035; group.add(parapet);
    // Flashing lights
    const lL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), getMat(0x5dade2, 0x5dade2));
    lL.position.set(-0.12, h2 + 0.12, 0); group.add(lL);
    const lR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), getMat(0xe74c3c, 0xe74c3c));
    lR.position.set(0.12, h2 + 0.12, 0); group.add(lR);
    // Sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w2 * 0.6, 0.1, 0.04), getMat(0x2471a3));
    sign.position.set(0, h2 * 0.7, w2 * 0.43); group.add(sign);
    // Steps
    const steps = new THREE.Mesh(new THREE.BoxGeometry(w2 * 0.38, 0.06, 0.14), getMat(0xbdc3c7));
    steps.position.set(0, 0.03, w2 * 0.44); group.add(steps);
    // Windows
    const wm = new THREE.MeshLambertMaterial({ color:0xd6eaf8, emissive:0x5dade2, emissiveIntensity:0.35 });
    for (const s of [-0.2, 0.2]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17), wm);
      win.position.set(s, h2 * 0.55, w2 * 0.43 + 0.001); group.add(win);
    }
    // Patrol car
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.36), getMat(0xffffff));
    car.position.set(w2 * 0.28, 0.05, -w2 * 0.28); group.add(car);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.18), getMat(0x2471a3));
    top.position.set(w2 * 0.28, 0.12, -w2 * 0.28); group.add(top);
    return group;
  }

  // ── Fire Station ───────────────────────────────────────────────────────
  if (type === 'fire') {
    const w2 = CELL * 0.74, h2 = 1.05;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, w2 * 0.85), getMat(0xc0392b));
    body.position.y = h2 / 2; body.castShadow = true; group.add(body);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.02, 0.07, w2 * 0.85 + 0.02), getMat(0xecf0f1));
    trim.position.y = h2 * 0.35; group.add(trim);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.06, 0.07, w2 * 0.85 + 0.06), getMat(0x922b21));
    roof.position.y = h2 + 0.035; group.add(roof);
    // Bay door
    const door = new THREE.Mesh(new THREE.BoxGeometry(w2 * 0.54, h2 * 0.5, 0.04), getMat(0xbdc3c7));
    door.position.set(0, h2 * 0.25, w2 * 0.43); group.add(door);
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w2 * 0.52, 0.025, 0.05), getMat(0x95a5a6));
      panel.position.set(0, 0.1 + i * 0.16, w2 * 0.43 + 0.02); group.add(panel);
    }
    // Siren
    const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.09), getMat(0x922b21));
    sb.position.set(0, h2 + 0.1, 0); group.add(sb);
    const siren = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), getMat(0xff4444, 0xff2222));
    siren.position.set(0, h2 + 0.21, 0); group.add(siren);
    // Fire truck
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.13, 0.44), getMat(0xe74c3c));
    truck.position.set(-w2 * 0.27, 0.065, -w2 * 0.27); group.add(truck);
    const tTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.21), getMat(0xc0392b));
    tTop.position.set(-w2 * 0.27, 0.17, -w2 * 0.27 - 0.05); group.add(tTop);
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), getMat(0xf39c12));
    ladder.position.set(-w2 * 0.27, 0.23, -w2 * 0.27); group.add(ladder);
    return group;
  }

  // ── All other zone types: use Kenney GLB ───────────────────────────────
  const cfg = modelConfig(type);
  if (cfg) {
    const mesh = cloneModel(cfg.file, cfg.tint, cfg.scale);
    if (mesh) {
      group.add(mesh);
      return group;
    }
  }

  // ── Ultimate fallback: plain coloured box ──────────────────────────────
  const def = ZONE_DEF[type];
  const h   = 0.8 + Math.random() * 0.8;
  const w   = CELL * 0.7;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), getMat(def?.color ?? 0x888888));
  box.position.y = h / 2;
  box.castShadow = true;
  group.add(box);
  return group;
}
