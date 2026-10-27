/**
 * meshes.js
 * Builds tile meshes. Every zone has several hand-modelled procedural
 * variants (windows, roofs, signage, yards, vehicles) plus the Kenney GLB
 * houses as extra residential variety. Roads auto-connect to neighbours.
 *
 * Each tile group exposes:
 *   userData.setPowered(bool) – toggles the floating "no power" badge
 *   userData.anim[]           – per-frame callbacks (smoke, sirens, flags)
 * and is driven by animateTile() from the render loop.
 */
import * as THREE from 'three';
import { CELL, ZONE_DEF } from './constants.js';
import { cloneModel } from './assets.js';
import {
  M, MAT, G, add, boxAt, facadeBlock, texturedPanel, prismGeo, coolingTowerGeo,
  rng, pick, tree, bush, hedge, streetLamp, bench, flagpole, vehicle, rooftop, bake,
} from './props.js';
import {
  grassTexture, asphaltTexture, paverTexture, shingleTexture, shopfrontTexture,
  awningTexture, signTexture, shutterTexture, fieldTexture, noPowerTexture,
} from './textures.js';

const HALF = CELL / 2;   // 0.6
const LOT  = CELL * 0.92; // buildable lot width
const L2   = LOT / 2;
const BASE = 0.03;       // lot plate height

// ── Shared surface materials ───────────────────────────────────────────────
const SURF = {
  grass:   () => M(0xffffff, { map: grassTexture(), r: 1 }),
  paved:   () => M(0xffffff, { map: paverTexture(), r: 0.9 }),
  asphalt: () => M(0xffffff, { map: asphaltTexture(), r: 0.95 }),
};

function lot(g, surface, zoneType) {
  boxAt(g, LOT, BASE, LOT, SURF[surface](), 0, 0, 0, { shadow: false });
  // Thin zone-coloured kerb so zones stay readable at a glance
  const kerb = M(ZONE_DEF[zoneType]?.color ?? 0x888888, { r: 0.6 });
  const t = 0.025;
  boxAt(g, LOT, BASE + 0.008, t, kerb,  0, 0,  L2 - t / 2, { shadow: false });
  boxAt(g, LOT, BASE + 0.008, t, kerb,  0, 0, -L2 + t / 2, { shadow: false });
  boxAt(g, t, BASE + 0.008, LOT, kerb,  L2 - t / 2, 0, 0, { shadow: false });
  boxAt(g, t, BASE + 0.008, LOT, kerb, -L2 + t / 2, 0, 0, { shadow: false });
}

const anim = (g, fn) => (g.userData.anim ??= []).push(fn);

function smoke(g, x, y, z, scale = 1, count = 5) {
  const mat = M(0xf4f4f4, { opacity: 0.6, r: 1 });
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const m = add(g, G.ico(0.06 * scale, 1), mat, x, y, z, { shadow: false });
    m.userData.noBake = true;
    puffs.push({ m, phase: i / count });
  }
  const speed = 0.18 + Math.random() * 0.06;
  anim(g, t => {
    for (const p of puffs) {
      const k = (t * speed + p.phase) % 1;
      p.m.position.set(x + k * 0.25 * scale, y + k * 0.7 * scale, z + k * 0.08 * scale);
      p.m.scale.setScalar(k < 0.85 ? 0.5 + k * 1.6 : (1 - k) / 0.15 * 1.86);
    }
  });
}

function blinkPair(g, a, b, rate = 4) {
  anim(g, t => {
    const on = Math.floor(t * rate) % 2 === 0;
    a.visible = on; b.visible = !on;
  });
}

function parapet(g, w, d, y, mat, t = 0.03, h = 0.04) {
  boxAt(g, w, h, t, mat, 0, y,  d / 2 - t / 2);
  boxAt(g, w, h, t, mat, 0, y, -d / 2 + t / 2);
  boxAt(g, t, h, d, mat,  w / 2 - t / 2, y, 0);
  boxAt(g, t, h, d, mat, -w / 2 + t / 2, y, 0);
}

/** Two sloped slabs plus wall-coloured gable ends. Ridge along x. */
function gableRoof(g, w, d, rh, y, z, wallHex, roofHex) {
  const wall = M(wallHex, { r: 0.85 });
  add(g, prismGeo(d, rh, w), wall, 0, y, z, { ry: Math.PI / 2 });
  const roof = M(0xffffff, { map: shingleTexture(roofHex), r: 0.9 });
  const a = Math.atan2(rh, d / 2);
  const len = Math.hypot(d / 2, rh) + 0.06;
  for (const s of [-1, 1]) {
    add(g, G.box(w + 0.08, 0.022, len), roof, 0, y + rh / 2 + 0.006, z + s * (d / 4 + 0.012), { rx: s * a });
  }
}

const WALLS_HOUSE = [0xf3e9d2, 0xdfe8ef, 0xf6d7b0, 0xe8d3d0, 0xd5e5d0, 0xfaf3e3, 0xcfd8dc];
const ROOFS       = [0x9c3d2e, 0x5b4636, 0x3e4a5c, 0x7a4b2a, 0x4e5d4a, 0x6d3b32];
const DOORS       = [0x6b3e26, 0x2e4a62, 0x8e2b2b, 0x2f5d3a, 0x3b3b3b];
const BRICKS      = [0xa0523d, 0x8e4b3b, 0xb5654a, 0x7d4a3a];

// ═══════════════════════════════════════════════════════════════════════════
//  RESIDENTIAL
// ═══════════════════════════════════════════════════════════════════════════
function buildHouse(g, r) {
  lot(g, 'grass', 'residential');
  const wall = pick(WALLS_HOUSE, r), roofC = pick(ROOFS, r);
  const floors = r() < 0.45 ? 2 : 1;
  const w = 0.6, d = 0.46, fh = 0.24, h = floors * fh, z = -0.1;
  facadeBlock(g, w, h, d, 0, BASE, z, { style: 'house', wall, bay: 0.19, floor: fh });
  gableRoof(g, w, d, 0.2, BASE + h, z, wall, roofC);
  // Chimney
  boxAt(g, 0.06, 0.22, 0.06, M(pick(BRICKS, r)), w * 0.3, BASE + h + 0.02, z - 0.08);
  // Door + porch
  const zf = z + d / 2;
  boxAt(g, 0.085, 0.15, 0.012, M(pick(DOORS, r), { r: 0.6 }), -0.12, BASE, zf + 0.004);
  boxAt(g, 0.16, 0.02, 0.08, MAT.concrete(), -0.12, BASE, zf + 0.04);
  boxAt(g, 0.18, 0.015, 0.1, M(roofC), -0.12, BASE + 0.19, zf + 0.05);
  for (const sx of [-0.2, -0.04]) boxAt(g, 0.012, 0.19, 0.012, MAT.white(), sx, BASE, zf + 0.09);
  // Front path
  boxAt(g, 0.08, 0.004, L2 - zf - 0.1, SURF.paved(), -0.12, BASE, (zf + 0.1 + L2) / 2);
  // Attached garage or side tree
  if (r() < 0.5) {
    facadeBlock(g, 0.22, 0.2, 0.3, w / 2 + 0.11, BASE, z + 0.07, { style: 'house', wall, bay: 0.3, floor: 0.4 });
    texturedPanel(g, 0.15, 0.13, shutterTexture(0xe6e3dc), w / 2 + 0.11, BASE + 0.065, z + 0.222);
    boxAt(g, 0.18, 0.004, L2 - (z + 0.22), M(0x9a9a9a), w / 2 + 0.11, BASE, (z + 0.22 + L2) / 2);
    if (r() < 0.5) {
      const car = vehicle(r() < 0.5 ? 'sedan' : 'hatch', null, r);
      car.position.set(w / 2 + 0.11, BASE, 0.38); car.scale.setScalar(0.8);
      g.add(car);
    }
  } else {
    tree(g, 0.4, 0.3, 0.95, pick(['round', 'tall', 'pine'], r), r);
  }
  // Picket fence or hedge along the front edge
  if (r() < 0.5) {
    const fz = L2 - 0.035;
    boxAt(g, LOT - 0.06, 0.012, 0.008, MAT.white(), 0, BASE + 0.05, fz);
    for (let x = -L2 + 0.04; x < L2 - 0.03; x += 0.045) {
      if (Math.abs(x + 0.12) < 0.05) continue;
      boxAt(g, 0.012, 0.075, 0.008, MAT.white(), x, BASE, fz);
    }
  } else {
    hedge(g, 0.3, 0.06, 0.25, L2 - 0.05);
    hedge(g, 0.2, 0.06, -0.38, L2 - 0.05);
  }
  tree(g, -0.38, -0.38, 0.8, pick(['round', 'pine'], r), r);
  bush(g, 0.05, zf + 0.05, 0.8, 0x5fa043);
  bush(g, -0.28, zf + 0.05, 0.7, 0xc0587a);
}

function buildApartment(g, r) {
  lot(g, 'paved', 'residential');
  const brick = r() < 0.5;
  const wall = brick ? pick(BRICKS, r) : pick([0xe9e1d3, 0xd8dee3, 0xf0d9b5, 0xc9d6c3], r);
  const floors = 3 + Math.floor(r() * 2);
  const fh = 0.25, w = 0.78, d = 0.6, h = floors * fh;
  facadeBlock(g, w, h, d, 0, BASE, -0.08, { style: brick ? 'brick' : 'apartment', wall, bay: 0.195, floor: fh });
  const trim = M(brick ? 0xd9d2c3 : 0x7f8c8d, { r: 0.8 });
  parapet(g, w + 0.02, d + 0.02, BASE + h, trim);
  rooftop(g, w, d, BASE + h, r);
  // Entrance canopy
  boxAt(g, 0.22, 0.02, 0.1, trim, 0, BASE + 0.2, -0.08 + d / 2 + 0.05);
  boxAt(g, 0.12, 0.17, 0.01, MAT.darkGlass(), 0, BASE, -0.08 + d / 2 + 0.004);
  // Grounds
  boxAt(g, 0.3, 0.008, 0.2, SURF.grass(), -0.3, BASE, 0.42, { shadow: false });
  tree(g, -0.32, 0.42, 0.8, 'round', r);
  tree(g, 0.42, 0.42, 0.75, pick(['round', 'tall'], r), r);
  bench(g, 0.15, 0.45);
}

const KENNEY_HOUSES = ['building-small-a.glb', 'building-small-b.glb', 'building-small-c.glb', 'building-small-d.glb'];
function buildKenneyHouse(g, r) {
  const m = cloneModel(pick(KENNEY_HOUSES, r), null, 0.92);
  if (!m) return buildHouse(g, r);
  lot(g, 'grass', 'residential');
  m.position.y = BASE;
  m.userData.noBake = true;
  g.add(m);
  tree(g, 0.42, 0.42, 0.75, 'round', r);
  bush(g, -0.42, 0.44, 0.9);
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMMERCIAL
// ═══════════════════════════════════════════════════════════════════════════
const SHOP_NAMES = ['CAFÉ', 'MARKET', 'BOOKS', 'PIZZA', 'BAKERY', 'DINER', 'DELI', 'FASHION', 'PHARMACY', 'FLOWERS', 'SUSHI', 'GROCER'];
const SIGN_COLS  = [0xc0392b, 0x16a085, 0x2c3e50, 0x8e44ad, 0xd35400, 0x27ae60, 0x2980b9];
const AWNINGS    = [[0xc0392b, 0xf5f5f5], [0x16a085, 0xf5f5f5], [0x2c3e50, 0xe8d8b0], [0xd35400, 0xfff2d6], [0x27ae60, 0xf5f5f5]];

function storefront(g, w, zf, wall, r, y0 = BASE) {
  texturedPanel(g, w * 0.96, 0.2, shopfrontTexture(wall), 0, y0 + 0.1, zf + 0.003, 0, 0.35);
  const [a, b] = pick(AWNINGS, r);
  add(g, G.box(w * 0.9, 0.012, 0.11), M(0xffffff, { map: awningTexture(a, b), r: 0.8 }), 0, y0 + 0.215, zf + 0.05, { rx: 0.35 });
  const col = pick(SIGN_COLS, r);
  boxAt(g, w * 0.6, 0.075, 0.015, M(col), 0, y0 + 0.24, zf + 0.004);
  texturedPanel(g, w * 0.58, 0.068, signTexture(pick(SHOP_NAMES, r), col), 0, y0 + 0.2775, zf + 0.0125, 0, 0.6);
}

function buildShops(g, r) {
  lot(g, 'paved', 'commercial');
  const wall = pick([0xe6d5b8, 0xcfd8dc, 0xb5654a, 0xf0e3c8, 0xd7c4a3], r);
  const floors = 1 + Math.floor(r() * 2);
  const w = 0.94, d = 0.6, fh = 0.3, h = floors * fh + 0.06, z = -0.14;
  facadeBlock(g, w, h, d, 0, BASE, z, { style: floors > 1 ? 'house' : 'concrete', wall, bay: 0.235, floor: fh });
  parapet(g, w + 0.02, d + 0.02, BASE + h, M(0x6d6d6d));
  rooftop(g, w, d, BASE + h, r);
  storefront(g, w, z + d / 2, wall, r);
  // Sidewalk furniture
  for (const x of [-0.36, 0.36]) {
    boxAt(g, 0.1, 0.05, 0.1, M(0x7f6a55), x, BASE, 0.38);
    bush(g, x, 0.38, 0.9, 0x4f8f3a).position.y += 0.05;
  }
  bench(g, 0, 0.42);
  // Café tables
  for (const x of [-0.18, 0.18]) {
    add(g, G.cyl(0.035, 0.035, 0.008, 10), MAT.white(), x, BASE + 0.06, 0.25);
    add(g, G.cyl(0.004, 0.004, 0.06, 4), MAT.darkMetal(), x, BASE + 0.03, 0.25);
    add(g, G.cone(0.06, 0.04, 8), M(pick(SIGN_COLS, r)), x, BASE + 0.16, 0.25);
    add(g, G.cyl(0.003, 0.003, 0.1, 4), MAT.darkMetal(), x, BASE + 0.11, 0.25);
  }
}

function buildOffice(g, r) {
  lot(g, 'paved', 'commercial');
  const glass = r() < 0.55;
  const wall = glass ? pick([0x9fb3c8, 0x7f9db8, 0xb8c4cc], r) : pick([0xd9d4c7, 0xb9bfc4, 0xe0d0b0], r);
  const floors = 5 + Math.floor(r() * 4);
  const fh = 0.22, w = 0.66, d = 0.62, h = floors * fh, z = -0.08;
  // Podium
  boxAt(g, w + 0.12, 0.06, d + 0.1, MAT.concrete(), 0, BASE, z);
  facadeBlock(g, w, h, d, 0, BASE + 0.06, z, { style: glass ? 'glass' : 'office', wall, bay: 0.165, floor: fh });
  // Setback crown
  const cw = w * 0.7, cd = d * 0.7, ch = 0.18;
  facadeBlock(g, cw, ch, cd, 0, BASE + 0.06 + h, z, { style: glass ? 'glass' : 'office', wall, bay: 0.115, floor: ch });
  const top = BASE + 0.06 + h + ch;
  parapet(g, cw + 0.02, cd + 0.02, top, MAT.darkMetal(), 0.02, 0.03);
  rooftop(g, cw, cd, top, r);
  add(g, G.cyl(0.006, 0.01, 0.35, 6), MAT.metal(), cw * 0.25, top + 0.175, z);
  add(g, G.sphere(0.012, 8, 6), M(0xff3b30, { e: 0xff0000, ei: 2 }), cw * 0.25, top + 0.355, z, { shadow: false });
  // Lobby canopy + plaza
  boxAt(g, 0.3, 0.015, 0.12, MAT.darkMetal(), 0, BASE + 0.22, z + d / 2 + 0.06);
  for (const x of [-0.13, 0.13]) add(g, G.cyl(0.008, 0.008, 0.16, 6), MAT.metal(), x, BASE + 0.14, z + d / 2 + 0.11);
  tree(g, -0.42, 0.42, 0.7, 'round', r);
  tree(g, 0.42, 0.42, 0.7, 'round', r);
  for (const x of [-0.42, 0.42]) add(g, G.cyl(0.07, 0.07, 0.04, 12), MAT.concrete(), x, BASE + 0.02, 0.42);
}

function buildMidrise(g, r) {
  lot(g, 'paved', 'commercial');
  const wall = pick(BRICKS.concat([0xd7c4a3, 0xc9b79c]), r);
  const w = 0.9, d = 0.66, upper = 2 + Math.floor(r() * 2), fh = 0.24, z = -0.1;
  facadeBlock(g, w, 0.32, d, 0, BASE, z, { style: 'concrete', wall: 0x6d6d6d, bay: 0.225, floor: 0.32 });
  storefront(g, w, z + d / 2, 0x4a4a4a, r);
  facadeBlock(g, w, upper * fh, d, 0, BASE + 0.32, z, { style: 'brick', wall, bay: 0.18, floor: fh });
  const top = BASE + 0.32 + upper * fh;
  boxAt(g, w + 0.04, 0.035, d + 0.04, MAT.white(), 0, top, z);
  rooftop(g, w, d, top + 0.035, r);
  streetLamp(g, -0.42, 0.42);
  streetLamp(g, 0.42, 0.42);
}

// ═══════════════════════════════════════════════════════════════════════════
//  INDUSTRIAL
// ═══════════════════════════════════════════════════════════════════════════
function chimney(g, x, z, h, r) {
  const white = MAT.white(), red = M(0xb03a2e, { r: 0.8 });
  const seg = h / 5;
  for (let i = 0; i < 5; i++) {
    const t0 = 1 - i * 0.05;
    add(g, G.cyl(0.055 * (t0 - 0.05), 0.055 * t0, seg, 14), i % 2 ? white : red, x, BASE + seg * (i + 0.5), z);
  }
  add(g, G.torus(0.048, 0.008, 6, 16), MAT.darkMetal(), x, BASE + h, z, { rx: Math.PI / 2 });
  smoke(g, x, BASE + h + 0.05, z, 1.1);
}

function buildFactory(g, r) {
  lot(g, 'asphalt', 'industrial');
  const wall = pick([0xb7b2a6, 0x9aa5ab, 0xc2b59b], r);
  const w = 0.82, d = 0.6, h = 0.34, z = -0.12, x0 = -0.08;
  facadeBlock(g, w, h, d, x0, BASE, z, { style: 'concrete', wall, bay: 0.2, floor: h });
  // Sawtooth roof
  const teeth = 4, tw = w / teeth;
  const roofM = M(0x8d9499, { r: 0.5, m: 0.5 });
  for (let i = 0; i < teeth; i++) {
    const cx = x0 - w / 2 + tw * (i + 0.5);
    add(g, prismGeo(tw, 0.12, d), roofM, cx, BASE + h, z, { s: [1, 1, 1] });
    boxAt(g, 0.006, 0.1, d * 0.96, MAT.glass(), cx + tw / 2 - 0.01, BASE + h, z);
  }
  // Loading doors
  for (const dx of [-0.2, 0.08]) texturedPanel(g, 0.16, 0.2, shutterTexture(0xd1b25a), x0 + dx, BASE + 0.1, z + d / 2 + 0.003);
  chimney(g, 0.42, -0.36, 1.1, r);
  // Pipes
  boxAt(g, 0.012, 0.012, 0.32, MAT.metal(), 0.36, BASE + 0.25, -0.2);
  add(g, G.cyl(0.02, 0.02, 0.4, 8), MAT.metal(), x0 + w / 2 + 0.02, BASE + 0.2, z + 0.15, { rx: 0 });
  // Yard: parking stripes and a truck
  const stripe = M(0xf1c40f, { r: 0.6 });
  for (let i = 0; i < 4; i++) boxAt(g, 0.012, 0.003, 0.14, stripe, -0.45 + i * 0.16, BASE, 0.38, { shadow: false });
  const truck = vehicle('truck', pick([0x2980b9, 0xecf0f1, 0xc0392b], r), r);
  truck.position.set(0.33, BASE, 0.33); truck.rotation.y = Math.PI / 2; truck.scale.setScalar(0.85);
  g.add(truck);
}

function container(g, x, y, z, ry, color) {
  const m = add(g, G.box(0.26, 0.1, 0.1), M(color, { r: 0.6, m: 0.3 }), x, y + 0.05, z, { ry });
  return m;
}

function buildWarehouse(g, r) {
  lot(g, 'asphalt', 'industrial');
  const wall = pick([0x9aa5ab, 0xc0c4c8, 0x8c9b8a, 0xb9a98a], r);
  const w = 0.9, d = 0.5, h = 0.38, z = -0.22;
  facadeBlock(g, w, h, d, 0, BASE, z, { style: 'concrete', wall, bay: 0.225, floor: h });
  boxAt(g, w + 0.03, 0.03, d + 0.03, MAT.darkMetal(), 0, BASE + h, z);
  // Dock: raised platform + three shutters
  boxAt(g, w * 0.8, 0.05, 0.08, MAT.concrete(), 0, BASE, z + d / 2 + 0.04);
  for (const dx of [-0.26, 0, 0.26]) {
    texturedPanel(g, 0.18, 0.22, shutterTexture(), dx, BASE + 0.16, z + d / 2 + 0.003);
    boxAt(g, 0.2, 0.012, 0.05, MAT.darkMetal(), dx, BASE + 0.28, z + d / 2 + 0.025);
  }
  // Container stacks
  const cols = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad, 0x16a085];
  container(g, -0.3, BASE, 0.25, 0, pick(cols, r));
  container(g, -0.3, BASE, 0.38, 0, pick(cols, r));
  container(g, -0.3, BASE + 0.1, 0.31, 0, pick(cols, r));
  container(g, 0.36, BASE, 0.32, Math.PI / 2, pick(cols, r));
  // Pallets
  for (let i = 0; i < 3; i++) {
    boxAt(g, 0.07, 0.02, 0.07, MAT.wood(), 0.05 + i * 0.09, BASE, 0.4);
    boxAt(g, 0.06, 0.05, 0.06, M(0xc8a165, { r: 0.9 }), 0.05 + i * 0.09, BASE + 0.02, 0.4);
  }
  const truck = vehicle('truck', null, r);
  truck.position.set(0.05, BASE, 0.22); truck.rotation.y = Math.PI; truck.scale.setScalar(0.85);
  g.add(truck);
}

function buildRefinery(g, r) {
  lot(g, 'asphalt', 'industrial');
  const tankM = M(pick([0xe8e8e8, 0xd7dde2], r), { r: 0.4, m: 0.4 });
  const tanks = [[-0.28, -0.25, 0.17, 0.4], [0.12, -0.3, 0.14, 0.34], [-0.3, 0.2, 0.13, 0.3]];
  for (const [x, z, rad, h] of tanks) {
    add(g, G.cyl(rad, rad, h, 20), tankM, x, BASE + h / 2, z);
    add(g, G.sphere(rad, 20, 8), tankM, x, BASE + h, z, { s: [1, 0.25, 1] });
    add(g, G.torus(rad + 0.004, 0.006, 4, 24), MAT.darkMetal(), x, BASE + h * 0.5, z, { rx: Math.PI / 2 });
    // Ladder
    boxAt(g, 0.02, h, 0.008, MAT.darkMetal(), x + rad, BASE, z);
  }
  // Pipe rack
  for (const x of [-0.05, 0.15, 0.35]) boxAt(g, 0.015, 0.2, 0.015, MAT.darkMetal(), x, BASE, 0.05);
  for (const [y, c] of [[0.2, 0xd35400], [0.17, 0xf1c40f], [0.14, 0x7f8c8d]])
    add(g, G.cyl(0.013, 0.013, 0.55, 8), M(c, { r: 0.5, m: 0.4 }), 0.12, BASE + y, 0.05, { rz: Math.PI / 2 });
  // Control office
  facadeBlock(g, 0.3, 0.22, 0.2, 0.3, BASE, 0.32, { style: 'office', wall: 0xd0d3d4, bay: 0.15, floor: 0.22 });
  // Flare stack
  add(g, G.cyl(0.02, 0.03, 0.9, 8), MAT.darkMetal(), 0.42, BASE + 0.45, -0.1);
  const flame = add(g, G.cone(0.03, 0.09, 8), M(0xffa21a, { e: 0xff6a00, ei: 2 }), 0.42, BASE + 0.95, -0.1, { shadow: false });
  flame.userData.noBake = true;
  anim(g, t => { const s = 0.8 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1; flame.scale.set(s, s * 1.2, s); });
}

// ═══════════════════════════════════════════════════════════════════════════
//  POWER PLANT
// ═══════════════════════════════════════════════════════════════════════════
function buildPower(g, r) {
  lot(g, 'asphalt', 'power');
  const shell = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.95, side: THREE.DoubleSide });
  for (const [x, z] of [[-0.25, -0.22], [0.2, -0.28]]) {
    const t = add(g, coolingTowerGeo(0.22, 0.15, 0.17, 0.85), shell, x, BASE, z);
    t.userData.noBake = true;
    add(g, G.torus(0.168, 0.01, 4, 24), M(0xb03a2e), x, BASE + 0.82, z, { rx: Math.PI / 2 });
    smoke(g, x, BASE + 0.9, z, 2.2, 6);
  }
  // Turbine hall
  facadeBlock(g, 0.5, 0.28, 0.24, -0.15, BASE, 0.28, { style: 'concrete', wall: 0x9aa5ab, bay: 0.125, floor: 0.28 });
  boxAt(g, 0.52, 0.03, 0.26, M(0xf1c40f, { r: 0.6 }), -0.15, BASE + 0.28, 0.28);
  // Transformer yard
  boxAt(g, 0.3, 0.008, 0.36, M(0x9b9b8f), 0.32, BASE, 0.22, { shadow: false });
  for (const [x, z] of [[0.26, 0.12], [0.38, 0.12], [0.26, 0.3], [0.38, 0.3]]) {
    boxAt(g, 0.08, 0.08, 0.06, MAT.darkMetal(), x, BASE, z);
    for (const dx of [-0.02, 0, 0.02]) add(g, G.cyl(0.005, 0.005, 0.04, 6), M(0xd8c690), x + dx, BASE + 0.1, z);
  }
  for (const z of [0.05, 0.42]) {
    boxAt(g, 0.012, 0.32, 0.012, MAT.metal(), 0.46, BASE, z);
    boxAt(g, 0.012, 0.012, 0.1, MAT.metal(), 0.46, BASE + 0.3, z);
  }
  boxAt(g, 0.004, 0.004, 0.37, MAT.darkMetal(), 0.46, BASE + 0.3, 0.235);
  // Hazard stripe edge
  for (let i = 0; i < 8; i++) boxAt(g, 0.06, 0.004, 0.025, M(i % 2 ? 0x2b2b2b : 0xf1c40f), -0.5 + i * 0.065, BASE, 0.47, { shadow: false });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SERVICES
// ═══════════════════════════════════════════════════════════════════════════
function buildSchool(g, r) {
  lot(g, 'grass', 'school');
  const wall = pick([0xb5654a, 0xc9a57a, 0xd8c3a5], r);
  const fh = 0.22;
  facadeBlock(g, 0.86, fh * 2, 0.36, 0, BASE, -0.3, { style: 'brick', wall, bay: 0.18, floor: fh });
  facadeBlock(g, 0.28, fh * 2, 0.32, -0.29, BASE, 0.03, { style: 'brick', wall, bay: 0.18, floor: fh });
  const trim = MAT.white();
  parapet(g, 0.88, 0.38, BASE + fh * 2, trim);
  boxAt(g, 0.3, 0.035, 0.34, trim, -0.29, BASE + fh * 2, 0.03);
  rooftop(g, 0.8, 0.3, BASE + fh * 2, r);
  // Entrance with columns and sign
  const zf = -0.3 + 0.18;
  boxAt(g, 0.3, 0.025, 0.12, trim, 0.14, BASE + 0.2, zf + 0.06);
  for (const x of [0.02, 0.26]) add(g, G.cyl(0.012, 0.012, 0.2, 8), trim, x, BASE + 0.1, zf + 0.11);
  texturedPanel(g, 0.3, 0.06, signTexture('SCHOOL', 0x1abc9c), 0.14, BASE + 0.26, zf + 0.122, 0, 0.4);
  boxAt(g, 0.12, 0.16, 0.01, MAT.darkGlass(), 0.14, BASE, zf + 0.004);
  // Sports court
  add(g, G.plane(0.42, 0.34), M(0xffffff, { map: fieldTexture(), r: 1 }), 0.22, BASE + 0.004, 0.25, { rx: -Math.PI / 2, shadow: false });
  for (const z of [0.1, 0.4]) {
    boxAt(g, 0.006, 0.07, 0.006, MAT.white(), 0.22 - 0.04, BASE, z);
    boxAt(g, 0.006, 0.07, 0.006, MAT.white(), 0.22 + 0.04, BASE, z);
    boxAt(g, 0.086, 0.006, 0.006, MAT.white(), 0.22, BASE + 0.07, z);
  }
  // Playground: slide + swings
  const px = -0.12, pz = 0.38;
  boxAt(g, 0.06, 0.1, 0.06, M(0xe74c3c), px - 0.08, BASE, pz);
  add(g, G.box(0.04, 0.008, 0.16), M(0xf1c40f, { m: 0.3, r: 0.4 }), px - 0.08, BASE + 0.055, pz + 0.09, { rx: 0.65 });
  for (const sx of [0.02, 0.14]) {
    add(g, G.cyl(0.004, 0.004, 0.13, 4), M(0x2980b9), px + sx, BASE + 0.06, pz - 0.03, { rx: 0.25 });
    add(g, G.cyl(0.004, 0.004, 0.13, 4), M(0x2980b9), px + sx, BASE + 0.06, pz + 0.03, { rx: -0.25 });
  }
  add(g, G.cyl(0.004, 0.004, 0.13, 4), M(0x2980b9), px + 0.08, BASE + 0.125, pz, { rz: Math.PI / 2 });
  flagpole(g, 0.42, -0.06, 0x2c3e50, 0.55);
  const bus = vehicle('bus', 0xf5b700, r);
  bus.position.set(-0.47, BASE, 0.3); bus.scale.setScalar(0.62);
  g.add(bus);
  tree(g, 0.44, -0.44, 0.7, 'round', r);
}

function buildPark(g, r) {
  lot(g, 'grass', 'park');
  const variant = Math.floor(r() * 3);
  const path = SURF.paved();
  if (variant === 0) {
    // Pond with island
    add(g, G.circle(0.24, 28), MAT.water(), 0.1, BASE + 0.006, -0.08, { shadow: false });
    add(g, G.torus(0.24, 0.018, 4, 32), M(0xb9ad94), 0.1, BASE + 0.004, -0.08, { rx: Math.PI / 2 });
    boxAt(g, LOT, 0.004, 0.09, path, 0, BASE, 0.32);
    boxAt(g, 0.09, 0.004, 0.32, path, -0.32, BASE, 0.12);
    for (let i = 0; i < 2; i++) {
      const duck = new THREE.Group();
      add(duck, G.sphere(0.018, 8, 6), MAT.white(), 0, 0.01, 0);
      add(duck, G.sphere(0.01, 6, 4), M(0x2f6b3b), 0, 0.025, 0.014);
      duck.userData.noBake = true;
      g.add(duck);
      const ph = i * Math.PI;
      anim(g, t => {
        const a = t * 0.3 + ph;
        duck.position.set(0.1 + Math.cos(a) * 0.13, BASE + 0.006, -0.08 + Math.sin(a) * 0.13);
        duck.rotation.y = -a;
      });
    }
    bench(g, 0.1, 0.25);
    bench(g, -0.15, 0.25);
    tree(g, -0.38, -0.36, 1.1, 'round', r);
    tree(g, 0.42, -0.4, 0.9, 'tall', r);
    tree(g, 0.42, 0.42, 0.95, pick(['round', 'autumn'], r), r);
    tree(g, -0.42, 0.42, 0.8, 'pine', r);
  } else if (variant === 1) {
    // Fountain plaza
    add(g, G.circle(0.34, 32), path, 0, BASE + 0.004, 0, { shadow: false });
    boxAt(g, LOT, 0.004, 0.1, path, 0, BASE, 0);
    boxAt(g, 0.1, 0.004, LOT, path, 0, BASE, 0);
    add(g, G.cyl(0.17, 0.18, 0.05, 24), MAT.concrete(), 0, BASE + 0.025, 0);
    add(g, G.cyl(0.15, 0.15, 0.052, 24), MAT.water(), 0, BASE + 0.026, 0);
    add(g, G.cyl(0.025, 0.035, 0.14, 10), MAT.concrete(), 0, BASE + 0.1, 0);
    add(g, G.cyl(0.07, 0.04, 0.02, 16), MAT.concrete(), 0, BASE + 0.17, 0);
    const jet = add(g, G.cone(0.03, 0.12, 10), M(0xd6f0ff, { opacity: 0.7, r: 0.1 }), 0, BASE + 0.24, 0, { shadow: false });
    jet.userData.noBake = true;
    anim(g, t => { jet.scale.y = 0.85 + Math.sin(t * 6) * 0.15; });
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      tree(g, x * 1.25, z * 1.25, 0.85, pick(['round', 'round', 'autumn'], r), r);
      for (let i = 0; i < 4; i++) bush(g, x + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.12, 0.6, pick([0xe84393, 0xfdcb6e, 0xffffff, 0xd63031], r));
    }
    bench(g, 0.24, 0.1, Math.PI / 2);
    bench(g, -0.24, -0.1, -Math.PI / 2);
    streetLamp(g, 0.1, 0.42);
    streetLamp(g, -0.1, -0.42, Math.PI);
  } else {
    // Woodland with winding path
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      boxAt(g, 0.1, 0.004, 0.18, path, Math.sin(t * Math.PI * 1.5) * 0.18, BASE, -L2 + 0.08 + t * (LOT - 0.16), { ry: Math.cos(t * Math.PI * 1.5) * 0.5 });
    }
    const spots = [[-0.38, -0.38], [-0.4, 0.05], [-0.36, 0.4], [0.4, -0.4], [0.38, -0.02], [0.4, 0.4], [-0.15, -0.2], [0.2, 0.22]];
    for (const [x, z] of spots) tree(g, x + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.06, 0.8 + r() * 0.4, pick(['round', 'pine', 'tall', 'pine', 'autumn'], r), r);
    for (let i = 0; i < 6; i++) bush(g, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9, 0.7);
    bench(g, 0.05, 0.05, Math.PI / 2);
    // Picnic table
    boxAt(g, 0.12, 0.01, 0.07, MAT.wood(), -0.12, BASE + 0.05, 0.36);
    for (const z of [0.31, 0.41]) boxAt(g, 0.12, 0.008, 0.025, MAT.wood(), -0.12, BASE + 0.03, z);
  }
}

function buildGovernment(g, r) {
  lot(g, 'grass', 'government');
  const stone = M(0xeee8da, { r: 0.75 }), stone2 = M(0xd8d0bd, { r: 0.8 });
  const z = -0.12;
  // Stepped podium
  boxAt(g, 0.92, 0.035, 0.66, stone2, 0, BASE, z);
  boxAt(g, 0.86, 0.035, 0.6, stone, 0, BASE + 0.035, z);
  const y0 = BASE + 0.07, h = 0.36;
  facadeBlock(g, 0.78, h, 0.42, 0, y0, z - 0.06, { style: 'house', wall: 0xeee8da, bay: 0.195, floor: h / 2 });
  // Portico: columns + entablature + pediment
  const zc = z + 0.2;
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + i * 0.12;
    add(g, G.cyl(0.022, 0.026, h, 12), stone, x, y0 + h / 2, zc);
    boxAt(g, 0.06, 0.015, 0.06, stone2, x, y0, zc);
  }
  boxAt(g, 0.72, 0.05, 0.14, stone, 0, y0 + h, zc - 0.04);
  add(g, prismGeo(0.74, 0.12, 0.15), stone2, 0, y0 + h + 0.05, zc - 0.04);
  // Front steps
  for (let i = 0; i < 3; i++) boxAt(g, 0.5, 0.023, 0.04, stone2, 0, BASE + i * 0.023, z + 0.33 + (2 - i) * 0.03);
  // Drum + dome + lantern
  const top = y0 + h;
  boxAt(g, 0.8, 0.03, 0.44, stone2, 0, top, z - 0.06);
  add(g, G.cyl(0.17, 0.17, 0.12, 24), stone, 0, top + 0.09, z - 0.08);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(g, G.cyl(0.008, 0.008, 0.12, 6), stone2, Math.cos(a) * 0.175, top + 0.09, z - 0.08 + Math.sin(a) * 0.175);
  }
  add(g, G.sphere(0.165, 24, 12), M(0x6f9f8f, { r: 0.4, m: 0.5 }), 0, top + 0.15, z - 0.08, { s: [1, 0.9, 1] });
  add(g, G.cyl(0.025, 0.03, 0.07, 10), stone, 0, top + 0.33, z - 0.08);
  add(g, G.sphere(0.02, 8, 6), M(0xd4af37, { m: 0.9, r: 0.25 }), 0, top + 0.38, z - 0.08);
  // Lawn details
  flagpole(g, -0.4, 0.38, 0x2471a3, 0.5);
  flagpole(g, 0.4, 0.38, 0xc0392b, 0.5);
  boxAt(g, 0.1, 0.004, 0.2, SURF.paved(), 0, BASE, 0.42);
  hedge(g, 0.24, 0.05, -0.2, 0.45);
  hedge(g, 0.24, 0.05, 0.2, 0.45);
}

function buildPolice(g, r) {
  lot(g, 'paved', 'police');
  const z = -0.18, w = 0.78, d = 0.44, fh = 0.24;
  facadeBlock(g, w, fh * 2, d, 0, BASE, z, { style: 'office', wall: 0x34495e, bay: 0.195, floor: fh });
  const trim = M(0x2471a3, { r: 0.6 });
  boxAt(g, w + 0.03, 0.035, d + 0.03, trim, 0, BASE + fh * 2, z);
  boxAt(g, w + 0.01, 0.025, d + 0.01, MAT.white(), 0, BASE + fh, z);
  rooftop(g, w, d, BASE + fh * 2 + 0.035, r);
  // Radio mast
  add(g, G.cyl(0.006, 0.012, 0.5, 6), MAT.metal(), -0.28, BASE + fh * 2 + 0.25, z - 0.1);
  add(g, G.sphere(0.012, 8, 6), M(0xff3b30, { e: 0xff0000, ei: 2 }), -0.28, BASE + fh * 2 + 0.5, z - 0.1, { shadow: false });
  // Entrance + sign
  const zf = z + d / 2;
  boxAt(g, 0.3, 0.02, 0.12, MAT.white(), 0, BASE + 0.2, zf + 0.06);
  boxAt(g, 0.14, 0.18, 0.01, MAT.darkGlass(), 0, BASE, zf + 0.004);
  texturedPanel(g, 0.34, 0.075, signTexture('POLICE', 0x1f4e8c), 0, BASE + fh * 2 - 0.08, zf + 0.004, 0, 0.7);
  // Blue lamps either side of the door
  for (const x of [-0.12, 0.12]) {
    add(g, G.box(0.03, 0.04, 0.03), M(0x5dade2, { e: 0x3498db, ei: 1.4 }), x, BASE + 0.15, zf + 0.02, { shadow: false });
  }
  // Car park with patrol cars
  for (let i = 0; i < 4; i++) boxAt(g, 0.01, 0.003, 0.18, MAT.white(), -0.44 + i * 0.21, BASE, 0.38, { shadow: false });
  for (const x of [-0.335, 0.085]) {
    const car = vehicle('police', 0x1c2833, r);
    car.position.set(x, BASE, 0.37); car.scale.setScalar(0.85);
    g.add(car);
    const [red, blue] = car.userData.siren;
    blinkPair(g, red, blue, 3 + r() * 2);
  }
  bush(g, 0.4, 0.38, 1);
}

function buildFire(g, r) {
  lot(g, 'asphalt', 'fire');
  const z = -0.16, w = 0.7, d = 0.46, fh = 0.26;
  const brick = pick([0xa93226, 0x922b21, 0xb03a2e], r);
  facadeBlock(g, w, fh * 2, d, -0.06, BASE, z, { style: 'brick', wall: brick, bay: 0.175, floor: fh });
  boxAt(g, w + 0.03, 0.035, d + 0.03, MAT.white(), -0.06, BASE + fh * 2, z);
  boxAt(g, w + 0.01, 0.025, d + 0.01, MAT.white(), -0.06, BASE + fh, z);
  const zf = z + d / 2;
  // Two engine bays
  for (const dx of [-0.2, 0.08]) {
    texturedPanel(g, 0.22, 0.22, shutterTexture(0xd0d3d4), -0.06 + dx, BASE + 0.115, zf + 0.004);
    boxAt(g, 0.25, 0.015, 0.02, MAT.white(), -0.06 + dx, BASE + 0.23, zf + 0.01);
  }
  texturedPanel(g, 0.42, 0.07, signTexture('FIRE DEPT', 0x7b241c, 0xffd54f), -0.06, BASE + fh + 0.11, zf + 0.004, 0, 0.5);
  // Hose tower
  const tx = 0.4, tz = -0.3;
  facadeBlock(g, 0.16, 0.95, 0.16, tx, BASE, tz, { style: 'brick', wall: brick, bay: 0.08, floor: 0.19 });
  add(g, G.cone(0.13, 0.12, 4), M(0x5b2c2c), tx, BASE + 1.01, tz, { ry: Math.PI / 4 });
  const sA = add(g, G.sphere(0.025, 8, 6), M(0xff3b30, { e: 0xff1a0a, ei: 2 }), tx - 0.04, BASE + 0.96, tz + 0.085, { shadow: false });
  const sB = add(g, G.sphere(0.025, 8, 6), M(0xff3b30, { e: 0xff1a0a, ei: 2 }), tx + 0.04, BASE + 0.96, tz + 0.085, { shadow: false });
  sA.userData.noBake = sB.userData.noBake = true;
  blinkPair(g, sA, sB, 2.5);
  // Apron markings + engine
  const yel = M(0xf1c40f, { r: 0.6 });
  for (const dx of [-0.2, 0.08]) {
    boxAt(g, 0.012, 0.003, 0.36, yel, -0.06 + dx - 0.12, BASE, 0.25, { shadow: false });
    boxAt(g, 0.012, 0.003, 0.36, yel, -0.06 + dx + 0.12, BASE, 0.25, { shadow: false });
  }
  const engine = vehicle('firetruck', 0xd32f2f, r);
  engine.position.set(-0.26, BASE, 0.28); engine.scale.setScalar(0.85);
  g.add(engine);
  // Hydrant
  add(g, G.cyl(0.018, 0.022, 0.06, 8), M(0xf1c40f, { r: 0.5 }), 0.4, BASE + 0.03, 0.4);
  add(g, G.sphere(0.02, 8, 6), M(0xf1c40f, { r: 0.5 }), 0.4, BASE + 0.065, 0.4);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROADS (auto-tiling)
// ═══════════════════════════════════════════════════════════════════════════
const SW = 0.15; // sidewalk width
const ARM = {    // direction → unit vector in tile space
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
};

function buildRoad(g, mask, r) {
  const curbH = 0.045;
  boxAt(g, CELL, 0.02, CELL, SURF.asphalt(), 0, 0, 0, { shadow: false });
  const walk = SURF.paved();
  const curb = M(0x9a9890, { r: 0.9 });
  // Corner squares are always present
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    boxAt(g, SW, curbH, SW, walk, sx * (HALF - SW / 2), 0, sz * (HALF - SW / 2), { shadow: false });
  }
  const inner = CELL - SW * 2;
  // Sidewalk strips on closed sides
  for (const [dir, [dx, dz]] of Object.entries(ARM)) {
    if (mask[dir]) continue;
    const along = dx === 0; // strip runs along x when side is n/s
    const px = dx * (HALF - SW / 2), pz = dz * (HALF - SW / 2);
    boxAt(g, along ? inner : SW, curbH, along ? SW : inner, walk, px, 0, pz, { shadow: false });
    boxAt(g, along ? inner : 0.012, curbH + 0.002, along ? 0.012 : inner, curb, dx * (HALF - SW), 0, dz * (HALF - SW), { shadow: false });
  }
  const arms = Object.keys(ARM).filter(k => mask[k]);
  const yellow = M(0xf4c430, { r: 0.6 });
  const white  = M(0xf5f5f5, { r: 0.6 });
  const y = 0.02;
  if (arms.length >= 3) {
    // Intersection: zebra crossings + stop lines on each arm
    for (const dir of arms) {
      const [dx, dz] = ARM[dir];
      const across = dz !== 0; // arm along z → stripes laid across x
      for (let i = 0; i < 5; i++) {
        const o = -inner / 2 + 0.07 + i * ((inner - 0.14) / 4);
        const d = HALF - 0.08;
        boxAt(g, across ? 0.05 : 0.12, 0.003, across ? 0.12 : 0.05, white,
          across ? o : dx * d, y, across ? dz * d : o, { shadow: false });
      }
    }
  } else if (arms.length > 0) {
    // Dashed centre line from the centre out along each arm
    for (const dir of arms) {
      const [dx, dz] = ARM[dir];
      for (const t of [0.12, 0.38]) {
        boxAt(g, dz ? 0.02 : 0.14, 0.003, dz ? 0.14 : 0.02, yellow, dx * (t + 0.07) * HALF / 0.6, y, dz * (t + 0.07) * HALF / 0.6, { shadow: false });
      }
    }
    if (arms.length === 2 && !(mask.n && mask.s) && !(mask.e && mask.w)) {
      boxAt(g, 0.02, 0.003, 0.02, yellow, 0, y, 0, { shadow: false });
    }
    // Street lamps on straight runs
    const straight = arms.length === 2 && ((mask.n && mask.s) || (mask.e && mask.w));
    if (straight && r() < 0.6) {
      const side = r() < 0.5 ? -1 : 1;
      if (mask.n) streetLamp(g, side * (HALF - SW / 2), 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      else        streetLamp(g, 0, side * (HALF - SW / 2), side > 0 ? Math.PI : 0);
    }
  }
  // Occasional tree on a closed sidewalk
  const closed = Object.keys(ARM).filter(k => !mask[k]);
  if (closed.length && r() < 0.25) {
    const [dx, dz] = ARM[pick(closed, r)];
    const off = (r() - 0.5) * 0.5;
    tree(g, dx ? dx * (HALF - SW / 2) : off, dz ? dz * (HALF - SW / 2) : off, 0.55, 'round', r);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════
const BUILDERS = {
  residential: [[buildHouse, 4], [buildApartment, 2], [buildKenneyHouse, 2]],
  commercial:  [[buildShops, 3], [buildOffice, 2], [buildMidrise, 2]],
  industrial:  [[buildFactory, 2], [buildWarehouse, 2], [buildRefinery, 1]],
  power:       [[buildPower, 1]],
  school:      [[buildSchool, 1]],
  park:        [[buildPark, 1]],
  government:  [[buildGovernment, 1]],
  police:      [[buildPolice, 1]],
  fire:        [[buildFire, 1]],
};

function weighted(list, r) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let v = r() * total;
  for (const [fn, w] of list) { if ((v -= w) <= 0) return fn; }
  return list[0][0];
}

let indicatorMat = null;

/**
 * Build a tile.
 * opts.mask   – {n,s,e,w} road neighbours (roads only)
 * opts.facing – y-rotation so the building fronts a road
 * opts.seed   – stable randomness (roads are rebuilt when neighbours change)
 * opts.spawn  – play the grow-in animation
 */
export function buildTileMesh(type, opts = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const r = opts.seed !== undefined ? rng(opts.seed) : Math.random;

  if (type === 'road') {
    buildRoad(body, opts.mask ?? {}, r);
  } else if (BUILDERS[type]) {
    weighted(BUILDERS[type], r)(body, r);
    body.rotation.y = opts.facing ?? 0;
  } else {
    const def = ZONE_DEF[type];
    boxAt(body, CELL * 0.7, 0.8, CELL * 0.7, M(def?.color ?? 0x888888), 0, 0, 0);
  }

  // Move animated pieces' callbacks onto the outer group, then bake the rest
  group.userData.anim = body.userData.anim ?? [];
  bake(body);

  if (type !== 'road' && type !== 'power') {
    indicatorMat ??= new THREE.SpriteMaterial({ map: noPowerTexture(), depthTest: false, transparent: true });
    const top = new THREE.Box3().setFromObject(body).max.y;
    const badge = new THREE.Sprite(indicatorMat);
    badge.scale.setScalar(0.28);
    badge.position.y = Math.min(top, 2.6) + 0.28;
    badge.renderOrder = 10;
    badge.visible = false;
    group.add(badge);
    const baseY = badge.position.y;
    group.userData.anim.push(t => { if (badge.visible) badge.position.y = baseY + Math.sin(t * 3) * 0.06; });
    group.userData.setPowered = p => { badge.visible = !p; };
  }

  if (opts.spawn) {
    group.userData.spawnAt = performance.now();
    body.scale.set(1, 0.001, 1);
  }
  group.userData.body = body;
  return group;
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

/** Decorative scenery for the land surrounding the buildable grid. */
export function buildScenery(gridHalf) {
  const g = new THREE.Group();
  const r = rng(1337);
  const placed = [];
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2;
    const d = gridHalf + 0.8 + r() * 16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < gridHalf + 0.6 && Math.abs(z) < gridHalf + 0.6) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 0.5)) continue;
    placed.push([x, z]);
    tree(g, x, z, 1.3 + r() * 1.2, pick(['round', 'pine', 'pine', 'tall', 'round', 'autumn'], r), r);
  }
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = gridHalf + 4 + r() * 12;
    add(g, G.ico(0.25 + r() * 0.35, 0), M(0x8d8d86, { flat: true, r: 1 }), Math.cos(a) * d, 0.08, Math.sin(a) * d, { s: [1, 0.55, 1.2], ry: r() * 3 });
  }
  return bake(g);
}
