/**
 * meshes.js
 * Tile meshes for the game. Buildings are modelled procedurally in
 * buildings.js (several variants per zone); this file auto-tiles the roads,
 * wraps each tile with its badges and animation hooks, and builds the
 * scenery that surrounds the grid.
 *
 * Each tile group exposes:
 *   userData.setPowered(bool) – toggles the floating "no power" badge
 *   userData.setRoad(bool)    – toggles the "no road access" badge
 *   userData.anim[]           – per-frame callbacks (smoke, sirens, flags)
 * and is driven by animateTile() from the render loop.
 */
import * as THREE from 'three';
import { CELL, ZONE_DEF, TYPE_ICONS } from './constants.js';
import {
  M, MAT, G, add, boxAt, slab, prismGeo, blobGeo, rng, pick, tree, bush, rock, fence, streetLamp, bench,
  trashBin, hydrant, planter, bikeRack, mailbox, trafficLight, busShelter, vehicle, bake, snowy,
} from './props.js';
import { noPowerTexture, noRoadTexture, badgeTexture, furrowTexture } from './textures.js';
import { HALF, SURF, themeHex } from './buildkit.js';
import { RES_STAGES, STYLES, BUILDERS } from './buildings.js';

// ═══════════════════════════════════════════════════════════════════════════
//  ROADS (auto-tiling)
// ═══════════════════════════════════════════════════════════════════════════
const SW = 0.15; // sidewalk width
const ARM = {    // direction → unit vector in tile space
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
};
const CURB_H = 0.045;

/** One piece of street furniture on a closed sidewalk, facing the carriageway. */
function furnish(g, r, dx, dz, straight) {
  const off = (r() - 0.5) * 0.56;
  const x = dx ? dx * (HALF - SW / 2) : off, z = dz ? dz * (HALF - SW / 2) : off;
  const ry = Math.atan2(-dx, -dz);
  const v = r();
  let item = null;
  if (v < 0.3) {
    // Street tree in a soil pit
    boxAt(g, 0.09, 0.004, 0.09, MAT.soil(), x, CURB_H, z, { shadow: false });
    item = tree(g, x, z, 0.5 + r() * 0.12, pick(['round', 'round', 'blossom', 'birch', 'autumn'], r), r);
  } else if (v < 0.42) item = bench(g, x - dx * 0.03, z - dz * 0.03, ry);
  else if (v < 0.52) { trashBin(g, x, z, CURB_H); return; }
  else if (v < 0.6) { hydrant(g, x + dx * 0.03, z + dz * 0.03, CURB_H); return; }
  else if (v < 0.7) item = planter(g, x, z, CURB_H, 0x5fa043, 0.9);
  else if (v < 0.77) item = bikeRack(g, x, z, ry + Math.PI / 2, r);
  else if (v < 0.83) item = mailbox(g, x, z, ry);
  else if (v < 0.9 && straight) item = busShelter(g, x - dx * 0.02, z - dz * 0.02, ry);
  if (item && v >= 0.3 && !(v >= 0.6 && v < 0.7)) item.position.y = CURB_H;
}

function buildRoad(g, mask, r) {
  slab(g, CELL, 0.02, CELL, SURF.asphalt(), 0, 0, 0, 1 / CELL, { shadow: false });
  const walk = SURF.paved();
  const curb = M(0x9a9890, { r: 0.9 });
  const pave = (w, d, x, z) => slab(g, w, CURB_H, d, walk, x, 0, z, 4, { shadow: false });
  // Corner squares are always present
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pave(SW, SW, sx * (HALF - SW / 2), sz * (HALF - SW / 2));
  const inner = CELL - SW * 2;
  // Sidewalk strips on closed sides
  for (const [dir, [dx, dz]] of Object.entries(ARM)) {
    if (mask[dir]) continue;
    const along = dx === 0; // strip runs along x when side is n/s
    pave(along ? inner : SW, along ? SW : inner, dx * (HALF - SW / 2), dz * (HALF - SW / 2));
    boxAt(g, along ? inner : 0.012, CURB_H + 0.002, along ? 0.012 : inner, curb, dx * (HALF - SW), 0, dz * (HALF - SW), { shadow: false });
  }
  const arms = Object.keys(ARM).filter(k => mask[k]);
  const closed = Object.keys(ARM).filter(k => !mask[k]);
  const yellow = M(0xf4c430, { r: 0.6 });
  const white  = M(0xf5f5f5, { r: 0.6 });
  const y = 0.02;
  const straight = arms.length === 2 && ((mask.n && mask.s) || (mask.e && mask.w));
  if (arms.length >= 3) {
    // Intersection: zebra crossings and a stop line on each arm
    for (const dir of arms) {
      const [dx, dz] = ARM[dir];
      const across = dz !== 0; // arm along z → stripes laid across x
      for (let i = 0; i < 6; i++) {
        const o = -inner / 2 + 0.06 + i * ((inner - 0.12) / 5);
        const d = HALF - 0.08;
        boxAt(g, across ? 0.045 : 0.12, 0.003, across ? 0.12 : 0.045, white,
          across ? o : dx * d, y, across ? dz * d : o, { shadow: false });
      }
      const d2 = HALF - 0.17;
      boxAt(g, across ? inner / 2 - 0.02 : 0.016, 0.003, across ? 0.016 : inner / 2 - 0.02, white,
        across ? -dz * inner / 4 : dx * d2, y, across ? dz * d2 : dx * inner / 4, { shadow: false });
    }
    // Signals on the near-side corner of each approach
    if (mask.s) trafficLight(g, HALF - SW + 0.04, HALF - 0.04, 0, CURB_H);
    if (mask.n) trafficLight(g, -HALF + SW - 0.04, -HALF + 0.04, Math.PI, CURB_H);
    if (mask.e) trafficLight(g, HALF - 0.04, -HALF + SW - 0.04, Math.PI / 2, CURB_H);
    if (mask.w) trafficLight(g, -HALF + 0.04, HALF - SW + 0.04, -Math.PI / 2, CURB_H);
  } else if (arms.length > 0) {
    // Dashed centre line from the centre out along each arm
    for (const dir of arms) {
      const [dx, dz] = ARM[dir];
      for (const t of [0.12, 0.38]) {
        boxAt(g, dz ? 0.02 : 0.14, 0.003, dz ? 0.14 : 0.02, yellow, dx * (t + 0.07) * HALF / 0.6, y, dz * (t + 0.07) * HALF / 0.6, { shadow: false });
      }
    }
    if (arms.length === 2 && !straight) boxAt(g, 0.02, 0.003, 0.02, yellow, 0, y, 0, { shadow: false });
    // White edge lines beside each kerb
    for (const dir of closed) {
      const [dx, dz] = ARM[dir];
      const e = HALF - SW - 0.035;
      boxAt(g, dx ? 0.012 : inner - 0.08, 0.003, dx ? inner - 0.08 : 0.012, white, dx * e, y, dz * e, { shadow: false });
    }
    if (straight && r() < 0.6) {
      const side = r() < 0.5 ? -1 : 1;
      if (mask.n) streetLamp(g, side * (HALF - SW / 2), 0, side > 0 ? -Math.PI / 2 : Math.PI / 2).position.y = CURB_H - 0.01;
      else        streetLamp(g, 0, side * (HALF - SW / 2), side > 0 ? Math.PI : 0).position.y = CURB_H - 0.01;
    }
  }
  // Manhole cover and a kerbside drain
  if (r() < 0.4) {
    const mx = (r() - 0.5) * 0.3, mz = (r() - 0.5) * 0.3;
    add(g, G.cyl(0.035, 0.035, 0.002, 12), M(0x2a2c30, { r: 0.6, m: 0.5 }), mx + 0.16, y + 0.001, mz - 0.14, { shadow: false });
  }
  if (closed.length && r() < 0.5) {
    const [dx, dz] = ARM[pick(closed, r)];
    const e = HALF - SW - 0.016, o = (r() - 0.5) * 0.4;
    boxAt(g, dx ? 0.022 : 0.07, 0.002, dx ? 0.07 : 0.022, M(0x1c1d20, { r: 0.7 }), dx ? dx * e : o, y, dz ? dz * e : o, { shadow: false });
  }
  // Furniture on the closed sidewalks
  for (const dir of closed) {
    if (r() < (straight ? 0.55 : 0.4)) furnish(g, r, ...ARM[dir], straight);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════
/** Residential density stage (0–2) for a population, with hysteresis so a
 *  home doesn't flip back and forth around a threshold. */
export function residentialStage(pop, cur = 0) {
  const up = pop >= 13 ? 2 : pop >= 7 ? 1 : 0;
  if (up > cur) return up;
  if (cur === 2 && pop < 10) return pop < 5 ? 0 : 1;
  if (cur === 1 && pop < 5) return 0;
  return cur;
}

function weighted(list, r) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let v = r() * total;
  for (const [fn, w] of list) { if ((v -= w) <= 0) return fn; }
  return list[0][0];
}

let indicatorMat = null, noRoadMat = null;
const badgeMats = {};

/**
 * Build a tile.
 * opts.mask   – {n,s,e,w} road neighbours (roads only)
 * opts.facing – y-rotation so the building fronts a road
 * opts.seed   – stable randomness (roads are rebuilt when neighbours change)
 * opts.spawn  – play the grow-in animation
 * opts.stage  – residential density stage 0–2 (see residentialStage)
 * opts.style  – commercial/industrial style id; unset picks a seeded mix
 */
export function buildTileMesh(type, opts = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const r = opts.seed !== undefined ? rng(opts.seed) : Math.random;

  if (type === 'road') {
    buildRoad(body, opts.mask ?? {}, r);
  } else if (BUILDERS[type]) {
    const list = type === 'residential' ? RES_STAGES[opts.stage ?? 0] : BUILDERS[type];
    (STYLES[type]?.[opts.style] ?? weighted(list, r))(body, r);
    body.rotation.y = opts.facing ?? 0;
  } else {
    const def = ZONE_DEF[type];
    boxAt(body, CELL * 0.7, 0.8, CELL * 0.7, M(def?.color ?? 0x888888), 0, 0, 0);
  }

  // Move animated pieces' callbacks onto the outer group, then bake the rest
  group.userData.anim = body.userData.anim ?? [];
  bake(body);

  // Service buildings carry a floating sign so they stand out from the zones
  let sign = null;
  if (TYPE_ICONS[type]) {
    const mat = badgeMats[type] ??= new THREE.SpriteMaterial({ map: badgeTexture(TYPE_ICONS[type], themeHex(type)), transparent: true });
    const top = new THREE.Box3().setFromObject(body).max.y;
    sign = new THREE.Sprite(mat);
    sign.scale.setScalar(0.3);
    sign.position.y = Math.min(top, 1.5) + 0.26;
    group.add(sign);
  }

  if (type !== 'road' && type !== 'power') {
    indicatorMat ??= new THREE.SpriteMaterial({ map: noPowerTexture(), depthTest: false, transparent: true });
    noRoadMat ??= new THREE.SpriteMaterial({ map: noRoadTexture(), depthTest: false, transparent: true });
    const top = new THREE.Box3().setFromObject(body).max.y;
    const badge = new THREE.Sprite(indicatorMat);
    badge.scale.setScalar(0.28);
    badge.position.y = Math.min(top, 2.6) + 0.28;
    badge.renderOrder = 10;
    badge.visible = false;
    group.add(badge);
    const baseY = badge.position.y;
    group.userData.anim.push(t => { if (badge.visible) badge.position.y = baseY + Math.sin(t * 3) * 0.06; });
    // One badge slot: missing power is the bigger problem, so it wins
    let powered = true, road = true;
    const refresh = () => {
      badge.visible = !powered || !road;
      badge.material = !powered ? indicatorMat : noRoadMat;
      if (sign) sign.visible = !badge.visible;
    };
    group.userData.setPowered = p => { powered = p; refresh(); };
    group.userData.setRoad = c => { road = c; refresh(); };
  }

  if (opts.spawn) {
    group.userData.spawnAt = performance.now();
    body.scale.set(1, 0.001, 1);
  }
  group.userData.body = body;
  return group;
}

/**
 * Free GPU memory for a removed tile. Only geometry/materials created for this
 * tile are disposed; shared cached ones stay alive for other tiles.
 */
export function disposeTile(group) {
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.ownsGeometry) o.geometry.dispose();
    if (o.userData.ownsMaterial) o.material.dispose();
  });
}

/** Per-frame update for a tile group (t = seconds). */
export function animateTile(group, t) {
  const ud = group.userData;
  if (ud.spawnAt !== undefined) {
    const k = Math.min(1, (performance.now() - ud.spawnAt) / 380);
    // easeOutBack
    const c = 1.70158, e = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
    ud.body.scale.set(1, Math.max(0.001, e), 1);
    if (k >= 1) { ud.body.scale.set(1, 1, 1); delete ud.spawnAt; }
  }
  if (ud.anim) for (const fn of ud.anim) fn(t);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCENERY
// ═══════════════════════════════════════════════════════════════════════════
/** Centre line of the river that runs past the far (north) side of the grid. */
const riverZ = (x, gridHalf) => -(gridHalf + 7.5) + Math.sin(x * 0.17) * 2.2 + Math.sin(x * 0.06 + 1) * 1.6;

/** Flat ribbon following the river, `width` wide, at height y. */
function riverRibbon(gridHalf, width, y) {
  const pts = [];
  for (let x = -70; x <= 70; x += 1) {
    const z = riverZ(x, gridHalf);
    const dz = riverZ(x + 0.5, gridHalf) - riverZ(x - 0.5, gridHalf);
    const len = Math.hypot(1, dz), nx = -dz / len, nz = 1 / len; // normal to the flow
    pts.push([x + nx * width / 2, z + nz * width / 2], [x - nx * width / 2, z - nz * width / 2]);
  }
  const pos = [], idx = [];
  pts.forEach(([x, z]) => pos.push(x, y, z));
  for (let i = 0; i < pts.length - 2; i += 2) idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Craggy unit cone (apex at +0.5, base at −0.5) for mountains. */
const peakGeos = [];
function peakGeo(v) {
  return peakGeos[v] ??= (() => {
    const g = new THREE.ConeGeometry(1, 1, 9, 4);
    const p = g.attributes.position, r = rng(4242 + v * 77), seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.49) continue;
      const key = `${p.getX(i).toFixed(3)},${y.toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let k = seen.get(key);
      if (k === undefined) seen.set(key, k = [0.78 + r() * 0.44, (r() - 0.5) * 0.1]);
      p.setXYZ(i, p.getX(i) * k[0], y > -0.49 ? y + k[1] : y, p.getZ(i) * k[0]);
    }
    g.computeVertexNormals();
    return g;
  })();
}

/** A small farm: barn, silo, windmill, fenced fields and hay bales. */
function farm(g, cx, cz, r) {
  const f = new THREE.Group();
  f.position.set(cx, 0, cz); f.rotation.y = -0.25;
  const crops = [0xd9b84a, 0x7fae4a, 0x9a7650, 0xb5c95a];
  [[-1.9, -1.2, 3, 2.2], [1.5, -1.5, 3.2, 1.8], [-1.6, 1.6, 2.6, 2.2]].forEach(([x, z, w, d], i) => {
    slab(f, w, 0.012, d, snowy(M(crops[(i + Math.floor(r() * 4)) % 4], { r: 1, map: furrowTexture() })), x, 0, z, 4, { shadow: false });
    fence(f, x - w / 2, z - d / 2, x + w / 2, z - d / 2, 'rail', 0);
    fence(f, x - w / 2, z + d / 2, x + w / 2, z + d / 2, 'rail', 0);
    fence(f, x - w / 2, z - d / 2, x - w / 2, z + d / 2, 'rail', 0);
    fence(f, x + w / 2, z - d / 2, x + w / 2, z + d / 2, 'rail', 0);
  });
  // Barn
  const red = M(0xa93a2c, { r: 0.9 }), roof = snowy(M(0x4a4f57, { r: 0.8 }), 0.85);
  boxAt(f, 1.0, 0.5, 0.7, red, 1.4, 0, 1.2);
  add(f, prismGeo(0.76, 0.3, 1.06), roof, 1.4, 0.5, 1.2, { ry: Math.PI / 2 });
  boxAt(f, 0.3, 0.34, 0.01, M(0x7a2a20, { r: 0.9 }), 1.4, 0, 1.556);
  for (const [w, h, x, y] of [[0.32, 0.012, 0, 0.34], [0.012, 0.34, -0.155, 0], [0.012, 0.34, 0.155, 0]]) boxAt(f, w, h, 0.014, MAT.white(), 1.4 + x, y, 1.558);
  boxAt(f, 0.16, 0.12, 0.01, MAT.white(), 1.4, 0.52, 1.556);
  // Silo
  add(f, G.cyl(0.2, 0.2, 0.9, 14), M(0xd9dee2, { r: 0.45, m: 0.5 }), 2.15, 0.45, 1.0);
  add(f, G.sphere(0.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb9c0c6, { r: 0.45, m: 0.5 }), 2.15, 0.9, 1.0);
  // Windmill
  add(f, G.cyl(0.07, 0.16, 1.1, 8), MAT.white(), 0.2, 0.55, 2.3);
  add(f, G.cone(0.1, 0.14, 8), red, 0.2, 1.17, 2.3);
  for (let i = 0; i < 4; i++) add(f, G.box(0.07, 0.62, 0.012), MAT.wood(), 0.2, 1.05, 2.4, { rz: i * Math.PI / 2 + 0.4 });
  // Hay bales and a pickup
  for (let i = 0; i < 7; i++) {
    add(f, G.cyl(0.09, 0.09, 0.14, 10), M(0xd8b95a, { r: 1 }), 0.1 + (i % 4) * 0.34 + r() * 0.1, 0.09, 0.4 + Math.floor(i / 4) * 0.4 + r() * 0.1, { rz: Math.PI / 2, ry: r() * 3 });
  }
  const pickup = vehicle('pickup', 0x2f7d4f, r);
  pickup.position.set(0.7, 0, 1.9); pickup.rotation.y = 1.1;
  f.add(pickup);
  tree(f, 2.5, 2.0, 1.8, 'oak', r);
  tree(f, -0.4, 0.2, 1.4, 'round', r);
  g.add(f);
}

/** Decorative scenery for the land surrounding the buildable grid. */
export function buildScenery(gridHalf) {
  const g = new THREE.Group();
  const r = rng(1337);

  // River with sandy banks
  const bank = new THREE.Mesh(riverRibbon(gridHalf, 4, 0.004), M(0xd9cba0, { r: 1 }));
  const water = new THREE.Mesh(riverRibbon(gridHalf, 2.8, 0.012), MAT.water());
  bank.receiveShadow = water.receiveShadow = true;
  bank.userData.noBake = water.userData.noBake = true;
  bank.userData.ownsGeometry = water.userData.ownsGeometry = true;
  g.add(bank, water);
  // Boulders in the shallows, reeds along the banks, a footbridge
  for (let i = 0; i < 14; i++) {
    const x = -40 + r() * 80;
    rock(g, x, riverZ(x, gridHalf) + (r() - 0.5) * 2.2, 3 + r() * 4, r, 0x8c8a82);
  }
  const reed = M(0x5c8f3f, { flat: true, r: 0.9 });
  for (let i = 0; i < 70; i++) {
    const x = -42 + r() * 84, side = r() < 0.5 ? -1 : 1;
    const z = riverZ(x, gridHalf) + side * (1.45 + r() * 0.35);
    for (let k = 0; k < 3; k++) add(g, G.cone(0.025, 0.3 + r() * 0.25, 4), reed, x + (r() - 0.5) * 0.2, 0.18, z + (r() - 0.5) * 0.2, { shadow: false });
  }
  {
    const bx = -5, bz = riverZ(bx, gridHalf);
    boxAt(g, 0.9, 0.05, 3.8, MAT.wood(), bx, 0.16, bz);
    for (const sx of [-1, 1]) {
      boxAt(g, 0.04, 0.04, 3.8, MAT.wood(), bx + sx * 0.43, 0.42, bz);
      for (let i = 0; i <= 6; i++) boxAt(g, 0.05, 0.42, 0.05, MAT.wood(), bx + sx * 0.43, 0, bz - 1.85 + i * 0.617);
    }
  }

  // Rolling hills, then distant mountains that fade into the haze
  const hillMats = [snowy(M(0x6f9a52, { flat: true, r: 1 })), snowy(M(0x7da85c, { flat: true, r: 1 }))];
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2, d = 32 + r() * 24, rad = 5 + r() * 6, h = 1.5 + r() * 3;
    add(g, blobGeo(i % 4), hillMats[i % 2], Math.cos(a) * d, -0.2, Math.sin(a) * d, { s: [rad, h, rad * (0.7 + r() * 0.6)], ry: r() * 3, shadow: false });
  }
  const rockM = M(0x7d8fa3, { flat: true, r: 1 }), foot = snowy(M(0x71877a, { flat: true, r: 1 }), 0.6), cap = M(0xf2f5f8, { flat: true, r: 0.9 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3, d = 68 + r() * 14, rad = 10 + r() * 7, h = 9 + r() * 9;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, ry = r() * 3, geo = peakGeo(i % 3);
    add(g, geo, rockM, x, h / 2 - 0.1, z, { s: [rad, h, rad], ry, shadow: false });
    const k = 0.34 + r() * 0.08; // snow cap: the same crag, shrunk onto the summit
    add(g, geo, cap, x, h - 0.1 - (k * h) / 2 + 0.01 * h, z, { s: [rad * k * 1.07, h * k, rad * k * 1.07], ry, shadow: false });
    // Foothills in front of each peak
    for (let j = 0; j < 2; j++) {
      const fa = a + (r() - 0.5) * 0.25, fd = d - rad * (0.55 + r() * 0.3), fh = h * (0.3 + r() * 0.2), fr = rad * (0.45 + r() * 0.2);
      add(g, peakGeo((i + j + 1) % 3), foot, Math.cos(fa) * fd, fh / 2 - 0.1, Math.sin(fa) * fd, { s: [fr, fh, fr], ry: r() * 3, shadow: false });
    }
  }

  // Farmland to the east
  const farmX = gridHalf + 7.5, farmZ = 1.5;
  farm(g, farmX, farmZ, r);

  // Woodland: groves of one dominant species, then scattered singles
  const placed = [];
  const free = (x, z, gap) =>
    !(Math.abs(x) < gridHalf + 0.7 && Math.abs(z) < gridHalf + 0.7) &&
    Math.abs(z - riverZ(x, gridHalf)) > 2.4 &&
    !(Math.abs(x - farmX) < 4.6 && Math.abs(z - farmZ) < 4.4) &&
    !placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < gap);
  const plant = (x, z, kinds, s) => {
    if (!free(x, z, 0.5)) return;
    placed.push([x, z]);
    tree(g, x, z, s, pick(kinds, r), r);
  };
  const SPECIES = [['pine', 'pine', 'pine', 'tall'], ['round', 'round', 'oak'], ['birch', 'birch', 'round'], ['oak', 'round', 'autumn'], ['pine', 'round', 'birch']];
  for (let i = 0; i < 32; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 3 + r() * 15;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, kinds = pick(SPECIES, r), n = 8 + Math.floor(r() * 9);
    for (let k = 0; k < n; k++) {
      const ta = r() * Math.PI * 2, td = Math.sqrt(r()) * 3.2;
      plant(cx + Math.cos(ta) * td, cz + Math.sin(ta) * td, kinds, 1.3 + r() * 1.3);
    }
  }
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 0.8 + r() * 18;
    plant(Math.cos(a) * d, Math.sin(a) * d, ['round', 'pine', 'tall', 'oak', 'birch', 'autumn', 'blossom'], 1.2 + r() * 1.2);
  }
  // Undergrowth: shrubs, boulders and wildflower patches
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 0.9 + r() * 14;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (free(x, z, 0.2)) bush(g, x, z, 1.6 + r() * 1.6, pick([0x4f8f3a, 0x3f7d36, 0x5fa043], r));
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 2 + r() * 14;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z, 0.3)) continue;
    rock(g, x, z, 3 + r() * 5, r);
    if (r() < 0.5) rock(g, x + 0.3, z + 0.2, 2 + r() * 2, r);
  }
  const petals = [0xffffff, 0xfdcb6e, 0xe84393, 0x9b6bdf, 0xff9f43];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 0.9 + r() * 10;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z, 0.15)) continue;
    const mat = M(pick(petals, r), { flat: true, r: 0.8 });
    for (let k = 0; k < 7; k++) add(g, G.ico(0.035, 0), mat, x + (r() - 0.5) * 0.6, 0.05, z + (r() - 0.5) * 0.6, { shadow: false });
  }
  return bake(g);
}
