/**
 * buildings.js — hand-modelled procedural buildings, one function per look.
 * Each builder fills a lot-sized group (see buildkit.js for lot space) and
 * takes a seeded rng so a tile keeps its look when it is rebuilt.
 */
import * as THREE from 'three';
import {
  M, MAT, G, add, boxAt, facadeBlock, texturedPanel, prismGeo, taperGeo, coolingTowerGeo, pick,
  tree, bush, hedge, flowerBed, rock, streetLamp, bench, trashBin, hydrant, mailbox, planter, bikeRack,
  picnicTable, parasolTable, fence, solarPanels, satelliteDish, acUnit, vehicle, rooftop,
} from './props.js';
import {
  shopfrontTexture, awningTexture, signTexture, shutterTexture, fieldTexture, clockTexture,
  helipadTexture, roofPanelTexture,
} from './textures.js';
import {
  LOT, L2, BASE, SURF, ground, lot, roofOf, trimOf, anim, smoke, blinkPair, beacon, parapet, band,
  gableRoof, hipRoof, dormer, balcony, steps, door, flag,
} from './buildkit.js';

// Homes: warm walls under blue roofs
const WALLS_HOUSE = [0xf1e4c8, 0xf3ecd8, 0xead9b6, 0xf0d9a4, 0xcfdfe9, 0xeecbb6, 0xd3dfc6];
const WALLS_APT   = [0xefe2c6, 0xe9d9b8, 0xe2dccd, 0xd6dfe6, 0xecd3c0];
const ROOFS       = [0x4a90d9, 0x4486cc, 0x5398dd, 0x3f7fc4];
const DOORS       = [0x6b3e26, 0x2e4a62, 0x8e2b2b, 0x2f5d3a, 0x3b3b3b, 0xd9a441];
const BRICKS      = [0xa0523d, 0x8e4b3b, 0xb5654a, 0x7d4a3a];
const PARASOLS    = [0xf39c12, 0xe74c3c, 0x2e86de, 0x27ae60, 0xf8f4ea];

// ═══════════════════════════════════════════════════════════════════════════
//  RESIDENTIAL
// ═══════════════════════════════════════════════════════════════════════════
/** Something for the garden, roughly 0.24 × 0.18. */
function yardExtra(g, r, x, z) {
  const k = Math.floor(r() * 6);
  if (k === 0) {                                   // swimming pool
    boxAt(g, 0.25, 0.012, 0.18, MAT.stone(), x, BASE, z);
    boxAt(g, 0.21, 0.014, 0.14, MAT.water(), x, BASE, z, { shadow: false });
    boxAt(g, 0.006, 0.03, 0.03, MAT.metal(), x + 0.09, BASE + 0.012, z - 0.06);
  } else if (k === 1) {                            // vegetable patch
    boxAt(g, 0.22, 0.01, 0.17, MAT.soil(), x, BASE, z, { shadow: false });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      add(g, G.ico(0.015, 0), M(j === 1 ? 0x7fb24a : 0x4f8f3a, { flat: true, r: 0.9 }), x - 0.075 + i * 0.05, BASE + 0.02, z - 0.05 + j * 0.05, { shadow: false });
    }
  } else if (k === 2) {                            // garden shed
    boxAt(g, 0.15, 0.11, 0.12, M(0x9c6b4a, { r: 0.9 }), x, BASE, z);
    add(g, prismGeo(0.18, 0.05, 0.15), M(0x55606b, { r: 0.8 }), x, BASE + 0.11, z);
    boxAt(g, 0.045, 0.08, 0.004, M(0x5a3a22), x - 0.02, BASE, z + 0.061);
    boxAt(g, 0.03, 0.03, 0.004, MAT.glass(), x + 0.04, BASE + 0.05, z + 0.061);
  } else if (k === 3) {                            // trampoline
    add(g, G.cyl(0.07, 0.07, 0.006, 12), M(0x22252a), x, BASE + 0.04, z);
    add(g, G.torus(0.072, 0.009, 5, 14), M(0x2e86de, { r: 0.6 }), x, BASE + 0.042, z, { rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.8;
      boxAt(g, 0.006, 0.04, 0.006, MAT.metal(), x + Math.cos(a) * 0.065, BASE, z + Math.sin(a) * 0.065);
    }
  } else if (k === 4) {                            // patio
    ground(g, 'paved', 0.22, 0.18, x, z);
    parasolTable(g, x, z, pick(PARASOLS, r), BASE);
  } else {                                         // sandbox and a ball
    boxAt(g, 0.14, 0.016, 0.14, MAT.wood(), x, BASE, z);
    boxAt(g, 0.12, 0.018, 0.12, M(0xe6d3a3, { r: 1 }), x, BASE, z, { shadow: false });
    add(g, G.sphere(0.015, 8, 6), M(0xe74c3c, { r: 0.5 }), x + 0.1, BASE + 0.015, z + 0.06);
    boxAt(g, 0.02, 0.012, 0.02, M(0xf1c40f), x - 0.02, BASE + 0.018, z + 0.02);
  }
}

/** Picket fence or hedge along the front of the lot, broken at each gap [x, halfWidth]. */
function frontEdge(g, r, gaps) {
  const z = L2 - 0.045, picket = r() < 0.55;
  const seg = (a, b) => {
    if (b - a < 0.06) return;
    if (picket) fence(g, a, z, b, z, 'picket', BASE);
    else hedge(g, b - a, 0.05, (a + b) / 2, z);
  };
  let from = -L2 + 0.05;
  for (const [x, hw] of [...gaps].sort((a, b) => a[0] - b[0])) { seg(from, x - hw); from = x + hw; }
  seg(from, L2 - 0.05);
}

/** Framed front door on a white entry panel that hides the window behind it. */
function entry(g, x, y, zf, r, w = 0.16, h = 0.215) {
  boxAt(g, w, h, 0.006, MAT.white(), x, y, zf + 0.003);
  door(g, x, y, zf + 0.004, pick(DOORS, r));
  for (const sx of [-1, 1]) boxAt(g, 0.018, 0.13, 0.004, MAT.glass(), x + sx * 0.062, y + 0.03, zf + 0.008);
}

function chimney(g, x, y, z, h, r) {
  boxAt(g, 0.07, h, 0.07, M(pick(BRICKS, r), { r: 0.9 }), x, y, z);
  boxAt(g, 0.086, 0.014, 0.086, MAT.stone(), x, y + h, z);
  boxAt(g, 0.04, 0.02, 0.04, MAT.darkMetal(), x, y + h + 0.014, z);
}

function driveway(g, x, z0, w = 0.2) {
  boxAt(g, w, 0.005, L2 - z0, M(0xa5a39c, { r: 0.95 }), x, BASE, (z0 + L2) / 2, { shadow: false });
}

function parkedCar(g, r, x, z, ry = 0, kinds = ['sedan', 'hatch', 'pickup']) {
  const car = vehicle(pick(kinds, r), null, r);
  car.position.set(x, BASE, z); car.rotation.y = ry; car.scale.setScalar(0.8);
  g.add(car);
  return car;
}

function buildCottage(g, r) {
  lot(g, 'grass', 'residential');
  const wall = pick(WALLS_HOUSE, r), roofC = pick(ROOFS, r);
  const garage = r() < 0.5;
  const w = 0.6, d = 0.44, h = 0.25, z = -0.12, x0 = garage ? -0.1 : -0.03, y0 = BASE + 0.02;
  boxAt(g, w + 0.02, 0.02, d + 0.02, MAT.stone(), x0, BASE, z);
  facadeBlock(g, w, h, d, x0, y0, z, { style: 'house', wall, bay: 0.2, floor: h, top: false });
  gableRoof(g, w, d, 0.2, y0 + h, x0, z, wall, roofC);
  chimney(g, x0 + w * 0.28, y0 + h + 0.02, z - 0.08, 0.24, r);
  if (r() < 0.5) dormer(g, x0 - 0.16, y0 + h + 0.03, z + 0.1, wall, roofC);
  // Gabled porch over the front door
  const zf = z + d / 2;
  entry(g, x0, y0, zf, r);
  boxAt(g, 0.24, 0.02, 0.11, MAT.concrete(), x0, BASE, zf + 0.055);
  boxAt(g, 0.13, 0.01, 0.03, MAT.concrete(), x0, BASE, zf + 0.125);
  for (const sx of [-1, 1]) boxAt(g, 0.012, 0.2, 0.012, MAT.white(), x0 + sx * 0.1, y0, zf + 0.095);
  gableRoof(g, 0.12, 0.25, 0.07, y0 + 0.2, x0, zf + 0.055, wall, roofC, Math.PI / 2);
  ground(g, 'paved', 0.08, L2 - zf - 0.14, x0, (zf + 0.14 + L2) / 2);
  mailbox(g, x0 + 0.09, L2 - 0.08);
  const gaps = [[x0, 0.06]];
  if (garage) {
    const xg = x0 + w / 2 + 0.125, zg = z + 0.03;
    boxAt(g, 0.25, 0.2, 0.32, M(wall, { r: 0.85 }), xg, BASE, zg);
    gableRoof(g, 0.32, 0.25, 0.09, BASE + 0.2, xg, zg, wall, roofC, Math.PI / 2);
    texturedPanel(g, 0.18, 0.15, shutterTexture(0xe6e3dc), xg, BASE + 0.075, zg + 0.163);
    driveway(g, xg, zg + 0.16);
    if (r() < 0.6) parkedCar(g, r, xg, 0.36);
    gaps.push([xg, 0.11]);
  } else {
    yardExtra(g, r, 0.41, -0.18);
    tree(g, 0.42, 0.3, 0.85, pick(['round', 'birch', 'blossom', 'autumn'], r), r);
  }
  flowerBed(g, x0 - 0.2, zf + 0.035, 0.15, 0.05, r);
  bush(g, x0 + 0.2, zf + 0.05, 0.8, 0x5fa043);
  tree(g, -0.42, -0.42, 0.8, pick(['round', 'pine', 'tall'], r), r);
  frontEdge(g, r, gaps);
}

function buildTownhouse(g, r) {
  lot(g, 'grass', 'residential');
  const brick = r() < 0.35;
  const wall = brick ? pick(BRICKS, r) : pick(WALLS_HOUSE, r), roofC = pick(ROOFS, r);
  const w = 0.48, d = 0.4, fh = 0.25, h = fh * 2, x0 = -0.14, z = -0.14, y0 = BASE + 0.02;
  boxAt(g, w + 0.02, 0.02, d + 0.02, MAT.stone(), x0, BASE, z);
  facadeBlock(g, w, h, d, x0, y0, z, { style: brick ? 'brick' : 'house', wall, bay: 0.16, floor: fh, top: false });
  hipRoof(g, w, d, 0.17, y0 + h, x0, z, roofC);
  chimney(g, x0 - w * 0.3, y0 + h + 0.02, z - 0.06, 0.22, r);
  // Full-width porch whose roof is the first-floor balcony
  const zf = z + d / 2;
  entry(g, x0, y0, zf, r);
  boxAt(g, w + 0.04, 0.02, 0.12, MAT.wood(), x0, BASE, zf + 0.06);
  boxAt(g, 0.14, 0.01, 0.03, MAT.concrete(), x0, BASE, zf + 0.135);
  for (const sx of [-1, 0, 1]) if (sx) boxAt(g, 0.014, fh - 0.01, 0.014, MAT.white(), x0 + sx * (w / 2), y0, zf + 0.105);
  balcony(g, x0, y0 + fh - 0.012, zf, w + 0.04, 0, false, 0.12);
  ground(g, 'paved', 0.08, L2 - zf - 0.15, x0, (zf + 0.15 + L2) / 2);
  // Side wing: garage with a roof terrace
  const xg = x0 + w / 2 + 0.13, zg = z + 0.02;
  boxAt(g, 0.26, 0.21, 0.32, M(brick ? 0xe9e4d8 : wall, { r: 0.85 }), xg, BASE, zg);
  boxAt(g, 0.28, 0.014, 0.34, roofOf('residential'), xg, BASE + 0.21, zg);
  parapet(g, 0.28, 0.34, BASE + 0.224, MAT.white(), 0.012, 0.035, xg, zg);
  texturedPanel(g, 0.18, 0.15, shutterTexture(0xe6e3dc), xg, BASE + 0.075, zg + 0.163);
  parasolTable(g, xg, zg, pick(PARASOLS, r), BASE + 0.224);
  driveway(g, xg, zg + 0.16);
  if (r() < 0.6) parkedCar(g, r, xg, 0.35);
  flowerBed(g, x0 - 0.15, zf + 0.16, 0.14, 0.05, r);
  tree(g, -0.43, 0.38, 0.8, pick(['round', 'blossom', 'birch'], r), r);
  tree(g, 0.4, -0.44, 0.8, pick(['pine', 'tall', 'round'], r), r);
  tree(g, -0.44, -0.4, 0.7, 'round', r);
  mailbox(g, x0 + 0.09, L2 - 0.08);
  frontEdge(g, r, [[x0, 0.06], [xg, 0.11]]);
}

function buildRanch(g, r) {
  lot(g, 'grass', 'residential');
  const wall = pick(WALLS_HOUSE, r), roofC = pick(ROOFS, r);
  const h = 0.24, y0 = BASE + 0.02, zm = -0.24;
  // Long main range across the back, wing coming forward on the left
  boxAt(g, 0.74, 0.02, 0.32, MAT.stone(), 0, BASE, zm);
  facadeBlock(g, 0.72, h, 0.3, 0, y0, zm, { style: 'house', wall, bay: 0.18, floor: h, top: false });
  gableRoof(g, 0.72, 0.3, 0.15, y0 + h, 0, zm, wall, roofC);
  boxAt(g, 0.32, 0.02, 0.38, MAT.stone(), -0.21, BASE, 0.09);
  facadeBlock(g, 0.3, h, 0.36, -0.21, y0, 0.09, { style: 'house', wall, bay: 0.15, floor: h, top: false });
  gableRoof(g, 0.44, 0.3, 0.15, y0 + h, -0.21, 0.05, wall, roofC, Math.PI / 2);
  chimney(g, 0.2, y0 + h + 0.02, zm - 0.05, 0.22, r);
  // Door in the corner under a lean-to porch, garage door at the far end
  const zf = zm + 0.15;
  entry(g, 0.09, y0, zf, r, 0.15);
  texturedPanel(g, 0.17, 0.16, shutterTexture(0xe6e3dc), 0.27, y0 + 0.08, zf + 0.004);
  boxAt(g, 0.2, 0.02, 0.12, MAT.concrete(), 0.04, BASE, zf + 0.06);
  add(g, G.box(0.24, 0.012, 0.15), M(roofC, { r: 0.85 }), 0.05, y0 + 0.215, zf + 0.06, { rx: 0.22 });
  boxAt(g, 0.012, 0.19, 0.012, MAT.white(), 0.15, y0, zf + 0.115);
  driveway(g, 0.27, zf, 0.21);
  ground(g, 'paved', 0.14, 0.07, 0.1, zf + 0.15);
  if (r() < 0.7) parkedCar(g, r, 0.27, 0.2);
  flowerBed(g, -0.21, 0.31, 0.26, 0.05, r);
  bush(g, -0.02, 0.2, 0.8, 0x5fa043);
  tree(g, 0.48, -0.02, 0.6, pick(['round', 'blossom', 'autumn'], r), r);
  tree(g, -0.46, -0.44, 0.75, pick(['pine', 'tall'], r), r);
  hedge(g, 0.5, 0.045, 0.2, -L2 + 0.07);
  mailbox(g, 0.13, L2 - 0.08);
  frontEdge(g, r, [[0.27, 0.12]]);
}

function buildVilla(g, r) {
  lot(g, 'grass', 'residential');
  const trim = trimOf('residential');
  const xl = -0.08, zl = -0.14, y0 = BASE + 0.015;
  // Ground floor, then a smaller offset upper storey with deep flat eaves
  boxAt(g, 0.64, 0.015, 0.42, MAT.stone(), xl, BASE, zl);
  facadeBlock(g, 0.62, 0.24, 0.4, xl, y0, zl, { style: 'plain', wall: 0xf4f1ea, bay: 0.155, floor: 0.24 });
  band(g, 0.62, 0.4, y0 + 0.24, trim, xl, zl, 0.02, 0.022);
  const xu = 0.04, zu = -0.17, yu = y0 + 0.262;
  facadeBlock(g, 0.38, 0.22, 0.34, xu, yu, zu, { style: 'plain', wall: pick([0xe9e4d8, 0xd9dde0, 0xe8dccb], r), bay: 0.19, floor: 0.22, roofMat: roofOf('residential') });
  band(g, 0.38, 0.34, yu + 0.22, trim, xu, zu, 0.035, 0.022);
  solarPanels(g, xu, yu + 0.242, zu, 3, 2);
  // Timber fin wall beside the entrance
  boxAt(g, 0.02, 0.48, 0.14, MAT.wood(), -0.215, y0, zl + 0.2);
  // Glass wall to the living room, solid front door
  const zf = zl + 0.2;
  boxAt(g, 0.3, 0.19, 0.006, MAT.glass(), 0.075, y0, zf + 0.003);
  for (const dx of [-0.075, 0.075]) boxAt(g, 0.008, 0.19, 0.01, MAT.darkMetal(), 0.075 + dx, y0, zf + 0.004);
  boxAt(g, 0.31, 0.012, 0.012, MAT.darkMetal(), 0.075, y0 + 0.19, zf + 0.004);
  entry(g, -0.31, y0, zf, r, 0.14);
  // Roof terrace on the lower block
  boxAt(g, 0.24, 0.05, 0.004, MAT.railGlass(), -0.27, y0 + 0.262, zf - 0.004, { shadow: false });
  boxAt(g, 0.004, 0.05, 0.3, MAT.railGlass(), -0.388, y0 + 0.262, zf - 0.15, { shadow: false });
  parasolTable(g, -0.28, zl + 0.02, pick(PARASOLS, r), y0 + 0.262);
  // Deck, pool and driveway
  boxAt(g, 0.36, 0.012, 0.16, MAT.wood(), 0.06, BASE, zf + 0.08);
  boxAt(g, 0.28, 0.012, 0.19, MAT.stone(), 0.1, BASE, 0.37);
  boxAt(g, 0.24, 0.014, 0.15, MAT.water(), 0.1, BASE, 0.37, { shadow: false });
  for (const dx of [-0.05, 0.03]) boxAt(g, 0.035, 0.012, 0.08, MAT.white(), 0.02 + dx, BASE + 0.012, zf + 0.1);
  ground(g, 'paved', 0.07, L2 - zf, -0.31, (zf + L2) / 2);
  driveway(g, 0.41, -0.3, 0.2);
  parkedCar(g, r, 0.41, -0.05, 0, ['sedan', 'hatch']);
  tree(g, -0.46, 0.28, 0.7, pick(['birch', 'tall'], r), r);
  tree(g, -0.45, -0.44, 0.75, 'tall', r);
  tree(g, -0.2, -0.46, 0.7, 'tall', r);
  hedge(g, 0.045, 0.5, -L2 + 0.07, -0.02);
  frontEdge(g, r, [[-0.31, 0.06], [0.41, 0.11]]);
}

/** Glazed stair/lift core up the middle of a front wall, with the entrance at its foot. */
function stairCore(g, y0, h, zf, trim, wide = 0.1) {
  boxAt(g, wide, h + 0.07, 0.04, M(0xdfe3e6, { r: 0.8 }), 0, y0, zf + 0.02);
  boxAt(g, wide - 0.04, h - 0.24, 0.006, MAT.glass(), 0, y0 + 0.22, zf + 0.042);
  for (let y = y0 + 0.25; y < y0 + h - 0.02; y += 0.25) boxAt(g, wide - 0.04, 0.012, 0.008, MAT.white(), 0, y, zf + 0.043);
  boxAt(g, wide + 0.03, 0.02, 0.06, trim, 0, y0 + h + 0.07, zf + 0.02);
  boxAt(g, wide - 0.02, 0.17, 0.006, MAT.darkGlass(), 0, y0, zf + 0.042);
  boxAt(g, 0.26, 0.014, 0.13, trim, 0, y0 + 0.19, zf + 0.085);
  for (const sx of [-1, 1]) add(g, G.cyl(0.006, 0.006, 0.19, 6), MAT.metal(), sx * 0.115, y0 + 0.095, zf + 0.14);
}

/** 3-floor walk-up. */
function buildWalkup(g, r) {
  lot(g, 'grass', 'residential');
  const brick = r() < 0.45;
  const wall = brick ? pick(BRICKS, r) : pick(WALLS_APT, r);
  const fh = 0.25, floors = 3, w = 0.76, d = 0.52, h = floors * fh, z = -0.12, y0 = BASE + 0.02;
  const zf = z + d / 2, trim = trimOf('residential');
  boxAt(g, w + 0.03, 0.02, d + 0.03, MAT.stone(), 0, BASE, z);
  facadeBlock(g, w, h, d, 0, y0, z, { style: brick ? 'brick' : 'apartment', wall, bay: 0.19, floor: fh, roofMat: roofOf('residential') });
  band(g, w, d, y0 + h - 0.034, MAT.white(), 0, z, 0.02, 0.03);
  parapet(g, w + 0.03, d + 0.03, y0 + h + 0.015, trim, 0.025, 0.035, 0, z);
  rooftop(g, w - 0.1, d - 0.1, y0 + h, r, 0, z);
  stairCore(g, y0, h, zf, trim);
  for (let f = 1; f < floors; f++) {
    for (const sx of [-1, 1]) {
      balcony(g, sx * 0.285, y0 + fh * f + 0.004, zf, 0.16, 0, !brick);
      balcony(g, sx * w / 2, y0 + fh * f + 0.004, z, 0.15, sx * Math.PI / 2, !brick);
    }
  }
  // Grounds
  boxAt(g, 0.22, 0.02, 0.09, MAT.concrete(), 0, BASE, zf + 0.085);
  ground(g, 'paved', 0.2, L2 - zf - 0.13, 0, (zf + 0.13 + L2) / 2);
  for (const sx of [-1, 1]) flowerBed(g, sx * 0.25, zf + 0.04, 0.2, 0.05, r);
  tree(g, -0.42, 0.42, 0.8, 'round', r);
  tree(g, 0.44, 0.4, 0.75, pick(['birch', 'blossom', 'tall'], r), r);
  bench(g, -0.22, 0.45);
  bikeRack(g, 0.24, 0.44, 0, r);
  trashBin(g, 0.13, 0.47, BASE);
  hedge(g, 0.045, 0.5, -L2 + 0.07, -0.12);
  hedge(g, 0.045, 0.5, L2 - 0.07, -0.12);
}

/** 5–6 floor apartment block with a penthouse. */
function buildTowerBlock(g, r) {
  lot(g, 'grass', 'residential');
  const wall = pick(WALLS_APT, r), trim = trimOf('residential');
  const floors = 5 + (r() < 0.5 ? 1 : 0);
  const fh = 0.25, w = 0.72, d = 0.58, h = floors * fh, z = -0.1, y0 = BASE + 0.05;
  const zf = z + d / 2, yT = y0 + h;
  boxAt(g, w + 0.1, 0.05, d + 0.1, MAT.stone(), 0, BASE, z);
  facadeBlock(g, w, h, d, 0, y0, z, { style: 'apartment', wall, bay: 0.18, floor: fh });
  band(g, w, d, yT - 0.034, MAT.white(), 0, z, 0.02, 0.03);
  stairCore(g, y0, h, zf, trim, 0.11);
  for (let f = 1; f < floors; f++) {
    for (const sx of [-1, 1]) {
      balcony(g, sx * 0.27, y0 + fh * f + 0.004, zf, 0.16, 0, true);
      balcony(g, sx * w / 2, y0 + fh * f + 0.004, z, 0.16, sx * Math.PI / 2, true);
    }
  }
  // Roof terrace around a glazed penthouse
  parapet(g, w + 0.03, d + 0.03, yT + 0.015, trim, 0.02, 0.035, 0, z);
  facadeBlock(g, 0.44, 0.2, 0.36, 0, yT, z - 0.04, { style: 'glass', wall: 0x9fb3c8, bay: 0.11, floor: 0.2, roofMat: roofOf('residential') });
  band(g, 0.44, 0.36, yT + 0.2, trim, 0, z - 0.04, 0.035, 0.022);
  for (const sx of [-1, 1]) planter(g, sx * 0.29, z + 0.2, yT, 0x5fa043);
  acUnit(g, 0.1, yT + 0.222, z - 0.08);
  satelliteDish(g, -0.12, yT + 0.222, z - 0.05, r() * 6);
  beacon(g, 0.17, yT + 0.222, z + 0.08, 0.16);
  // Grounds: forecourt, visitor parking, planting
  ground(g, 'paved', 0.3, L2 - zf, 0, (zf + L2) / 2);
  ground(g, 'asphalt', 0.2, 0.34, 0.4, 0.36);
  boxAt(g, 0.006, 0.006, 0.3, MAT.white(), 0.295, BASE, 0.36, { shadow: false });
  parkedCar(g, r, 0.4, 0.36, Math.PI);
  tree(g, -0.42, 0.42, 0.85, 'round', r);
  tree(g, -0.27, 0.3, 0.7, pick(['blossom', 'birch'], r), r);
  bench(g, -0.3, 0.47);
  streetLamp(g, 0.2, 0.47, Math.PI);
  bikeRack(g, -0.46, 0.14, Math.PI / 2, r);
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMMERCIAL
// ═══════════════════════════════════════════════════════════════════════════
const SHOP_NAMES = ['CAFÉ', 'MARKET', 'BOOKS', 'PIZZA', 'BAKERY', 'DINER', 'DELI', 'FASHION', 'PHARMACY', 'FLOWERS', 'SUSHI', 'GROCER', 'TOYS', 'BIKES'];
const BIG_SIGNS  = ['HOTEL', 'BANK', 'CINEMA', 'GYM', 'MALL', 'RADIO'];
// Commerce: pale walls and glass with amber awnings, signs and roofs
const SIGN_COLS  = [0xb9690d, 0x2c3e50, 0xd9822b, 0x8e3b2e];
const AWNINGS    = [[0xf39c12, 0xf8f4ea], [0xe08e0b, 0xfff2d6], [0xd35400, 0xf8f4ea]];

/**
 * Shopfront across a wall face at zf: glazing, fascia with one sign and one
 * striped awning per shop unit, and wall lamps. `fasciaH` covers the wall above.
 */
function storefront(g, w, zf, wall, r, { y0 = BASE, units = 2, fasciaH = 0.12 } = {}) {
  texturedPanel(g, w * 0.97, 0.2, shopfrontTexture(wall), 0, y0 + 0.1, zf + 0.003, 0, 0.35);
  boxAt(g, w, fasciaH, 0.014, M(0x3a3d42, { r: 0.7 }), 0, y0 + 0.2, zf + 0.001);
  const uw = w / units;
  for (let i = 0; i < units; i++) {
    const x = -w / 2 + uw * (i + 0.5);
    const [a, b] = pick(AWNINGS, r), col = pick(SIGN_COLS, r);
    add(g, G.box(uw * 0.9, 0.01, 0.12), M(0xffffff, { map: awningTexture(a, b), r: 0.8 }), x, y0 + 0.212, zf + 0.06, { rx: 0.38 });
    boxAt(g, uw * 0.9, 0.022, 0.004, M(a, { r: 0.8 }), x, y0 + 0.168, zf + 0.115);
    boxAt(g, uw * 0.74, 0.075, 0.016, M(col, { r: 0.6 }), x, y0 + 0.235, zf + 0.012);
    texturedPanel(g, uw * 0.7, 0.062, signTexture(pick(SHOP_NAMES, r), col), x, y0 + 0.2725, zf + 0.021, 0, 0.6);
  }
  for (let i = 0; i <= units; i++) {
    boxAt(g, 0.022, 0.2, 0.02, M(0x3a3d42, { r: 0.7 }), -w / 2 + uw * i + (i === 0 ? 0.011 : i === units ? -0.011 : 0), y0, zf + 0.008);
  }
}

function buildShops(g, r) {
  lot(g, 'paved', 'commercial');
  const wall = pick([0xe9e4d8, 0xdfe3e6, 0xf0e8d8, 0xe6d9c8], r), trim = trimOf('commercial');
  const w = 0.94, d = 0.58, h = 0.36, z = -0.16, zf = z + d / 2, yT = BASE + h;
  facadeBlock(g, w, h, d, 0, BASE, z, { style: 'plain', wall, bay: 0.235, floor: h });
  storefront(g, w, zf, wall, r, { fasciaH: h - 0.2 });
  parapet(g, w + 0.03, d + 0.03, yT, trim, 0.03, 0.045, 0, z);
  // Half the shops have a flat above one unit
  const flat = r() < 0.5, side = r() < 0.5 ? -1 : 1;
  if (flat) {
    facadeBlock(g, 0.46, 0.24, 0.42, side * 0.23, yT, z - 0.06, { style: 'apartment', wall, bay: 0.153, floor: 0.24, roofMat: roofOf('commercial') });
    band(g, 0.46, 0.42, yT + 0.24, trim, side * 0.23, z - 0.06, 0.02, 0.025);
    balcony(g, side * 0.23, yT + 0.01, z - 0.06 + 0.21, 0.3, 0, false, 0.06);
    rooftop(g, 0.36, 0.4, yT, r, -side * 0.24, z - 0.02);
  } else {
    // Stepped pediment over the middle of the frontage
    boxAt(g, 0.42, 0.075, 0.035, trim, 0, yT + 0.045, zf - 0.0025);
    boxAt(g, 0.26, 0.04, 0.035, trim, 0, yT + 0.12, zf - 0.0025);
    rooftop(g, w - 0.12, d - 0.16, yT, r, 0, z - 0.03);
  }
  // Pavement life: café seating on one side, produce stand on the other
  const cafe = r() < 0.5 ? -1 : 1;
  parasolTable(g, cafe * 0.34, 0.3, pick(PARASOLS, r), BASE);
  parasolTable(g, cafe * 0.14, 0.34, pick(PARASOLS, r), BASE);
  for (let i = 0; i < 3; i++) {
    const cx = -cafe * (0.12 + i * 0.1);
    boxAt(g, 0.085, 0.04, 0.06, MAT.wood(), cx, BASE, zf + 0.05, { rx: -0.2 });
    for (let k = 0; k < 3; k++) add(g, G.ico(0.014, 0), M(pick([0xe74c3c, 0xf39c12, 0x7fb24a, 0xf1c40f], r), { flat: true }), cx - 0.025 + k * 0.025, BASE + 0.05, zf + 0.05, { shadow: false });
  }
  // A-frame sign
  for (const s of [-1, 1]) add(g, G.box(0.05, 0.075, 0.004), M(0x2c3e50, { r: 0.7 }), -cafe * 0.08, BASE + 0.036, 0.42 + s * 0.012, { rx: s * 0.28 });
  planter(g, -0.48, zf + 0.06, BASE, 0x4f8f3a);
  planter(g, 0.48, zf + 0.06, BASE, 0x4f8f3a);
  bench(g, -cafe * 0.32, 0.46, Math.PI);
  trashBin(g, -cafe * 0.48, 0.44, BASE);
  streetLamp(g, cafe * 0.5, 0.47, Math.PI);
}

function buildMidrise(g, r) {
  lot(g, 'paved', 'commercial');
  const brick = r() < 0.5;
  const wall = brick ? pick(BRICKS, r) : pick([0xdcd6c8, 0xd3d8dc, 0xe2d9c6], r);
  const w = 0.9, d = 0.64, upper = 3 + (r() < 0.4 ? 1 : 0), fh = 0.24, z = -0.12, gh = 0.32;
  const zf = z + d / 2, yU = BASE + gh, top = yU + upper * fh, trim = trimOf('commercial');
  facadeBlock(g, w, gh, d, 0, BASE, z, { style: 'plain', wall: 0x6d7076, bay: 0.225, floor: gh, top: false });
  storefront(g, w, zf, 0x4a4a4a, r, { units: 3, fasciaH: gh - 0.2 });
  band(g, w, d, yU - 0.012, MAT.stone(), 0, z, 0.02, 0.028);
  facadeBlock(g, w, upper * fh, d, 0, yU, z, { style: brick ? 'brick' : 'office', wall, bay: 0.18, floor: fh });
  // Stone corner piers and a deep amber cornice
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(g, 0.04, upper * fh, 0.04, MAT.stone(), sx * w / 2, yU, z + sz * d / 2);
  band(g, w, d, top - 0.01, MAT.stone(), 0, z, 0.03, 0.02);
  band(g, w, d, top + 0.01, trim, 0, z, 0.045, 0.035);
  parapet(g, w + 0.02, d + 0.02, top + 0.045, MAT.stone(), 0.025, 0.03, 0, z);
  rooftop(g, w - 0.12, d - 0.3, top + 0.045, r, 0, z - 0.1);
  if (r() < 0.6) {
    // Rooftop billboard
    const col = pick(SIGN_COLS, r);
    for (const sx of [-0.2, 0.2]) boxAt(g, 0.012, 0.1, 0.012, MAT.darkMetal(), sx, top + 0.04, zf - 0.09);
    boxAt(g, 0.54, 0.16, 0.014, MAT.darkMetal(), 0, top + 0.12, zf - 0.09);
    texturedPanel(g, 0.52, 0.14, signTexture(pick(BIG_SIGNS, r), col), 0, top + 0.2, zf - 0.082, 0, 0.7);
  }
  if (brick) {
    // Fire escape down the side
    const fx = w / 2 + 0.035, dm = MAT.darkMetal();
    for (let f = 1; f <= upper; f++) {
      const fy = yU + fh * (f - 1) + 0.03;
      boxAt(g, 0.07, 0.008, 0.26, dm, fx, fy, z);
      boxAt(g, 0.005, 0.05, 0.26, dm, fx + 0.033, fy + 0.008, z);
      if (f > 1) add(g, G.box(0.006, 0.006, 0.27), dm, fx, fy - fh / 2 + 0.01, z, { rx: (f % 2 ? 1 : -1) * 1.1 });
    }
    add(g, G.box(0.006, 0.006, 0.2), dm, fx, BASE + 0.2, z + 0.05, { rx: 1.25 });
  }
  streetLamp(g, -0.47, 0.47, Math.PI);
  streetLamp(g, 0.47, 0.47, Math.PI);
  planter(g, -0.3, 0.44, BASE, 0x5fa043);
  planter(g, 0.3, 0.44, BASE, 0x5fa043);
  bench(g, 0, 0.46, Math.PI);
  trashBin(g, 0.16, 0.46, BASE);
  hydrant(g, -0.16, 0.48, BASE);
}

/** Podium entrance: lit glass doors under a canopy. */
function lobby(g, zf, y0, trim, w = 0.28) {
  boxAt(g, w, 0.2, 0.012, MAT.lit(), 0, y0, zf + 0.004);
  for (const dx of [-w / 2, -w / 6, w / 6, w / 2]) boxAt(g, 0.008, 0.2, 0.016, MAT.darkMetal(), dx, y0, zf + 0.006);
  boxAt(g, w + 0.08, 0.016, 0.14, trim, 0, y0 + 0.205, zf + 0.07);
  for (const sx of [-1, 1]) add(g, G.cyl(0.007, 0.007, 0.205, 6), MAT.metal(), sx * (w / 2 + 0.02), y0 + 0.1, zf + 0.125);
}

function plaza(g, r, trim) {
  for (const sx of [-1, 1]) {
    add(g, G.cyl(0.075, 0.085, 0.045, 12), MAT.concrete(), sx * 0.42, BASE + 0.0225, 0.42);
    tree(g, sx * 0.42, 0.42, 0.7, pick(['round', 'blossom', 'birch'], r), r).position.y = 0.04;
  }
  // Abstract sculpture on a plinth
  boxAt(g, 0.07, 0.05, 0.07, MAT.stone(), 0.2, BASE, 0.44);
  add(g, G.torus(0.045, 0.012, 6, 16), trim, 0.2, BASE + 0.1, 0.44, { ry: 0.6 });
  bench(g, -0.18, 0.46, Math.PI);
  trashBin(g, -0.02, 0.47, BASE);
}

/** Glass curtain-wall tower on a podium. */
function buildGlassTower(g, r) {
  lot(g, 'paved', 'commercial');
  const wall = pick([0x9fb3c8, 0x8fa9c2, 0x86b3b8], r), trim = trimOf('commercial');
  const floors = 6 + Math.floor(r() * 3);
  const fh = 0.22, w = 0.62, d = 0.58, h = floors * fh, z = -0.1, ph = 0.26;
  // Podium
  const pw = w + 0.16, pd = d + 0.14, zp = z + pd / 2;
  facadeBlock(g, pw, ph, pd, 0, BASE, z, { style: 'office', wall: 0xd7d9dc, bay: 0.195, floor: ph });
  band(g, pw, pd, BASE + ph, trim, 0, z, 0.012, 0.028);
  lobby(g, zp, BASE, trim);
  // Shaft with corner fins
  const yS = BASE + ph + 0.028, top = yS + h;
  facadeBlock(g, w, h, d, 0, yS, z, { style: 'glass', wall, bay: 0.155, floor: fh });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(g, 0.022, h + 0.05, 0.022, MAT.metal(), sx * w / 2, yS, z + sz * d / 2);
  for (const sx of [-1, 1]) planter(g, sx * (pw / 2 - 0.05), zp - 0.05, BASE + ph + 0.028, 0x5fa043, 0.8);
  band(g, w, d, top - 0.03, trim, 0, z, 0.012, 0.04);
  // Mechanical crown
  const cw = w * 0.72, cd = d * 0.72, ch = 0.17;
  facadeBlock(g, cw, ch, cd, 0, top, z, { style: 'glass', wall, bay: 0.11, floor: ch, roofMat: roofOf('commercial') });
  parapet(g, cw + 0.02, cd + 0.02, top + ch, trim, 0.02, 0.03, 0, z);
  parapet(g, w + 0.01, d + 0.01, top + 0.01, MAT.metal(), 0.012, 0.03, 0, z);
  if (r() < 0.45) {
    add(g, G.circle(0.17, 24), M(0xffffff, { map: helipadTexture(), r: 0.9 }), 0, top + ch + 0.004, z, { shadow: false });
    beacon(g, cw / 2 - 0.02, top + ch, z - cd / 2 + 0.02, 0.1);
  } else {
    rooftop(g, cw - 0.06, cd - 0.06, top + ch, r, 0, z);
    beacon(g, cw * 0.25, top + ch, z - cd * 0.2, 0.4);
  }
  plaza(g, r, trim);
}

/** Stepped stone tower with a pyramid crown. */
function buildDecoTower(g, r) {
  lot(g, 'paved', 'commercial');
  const wall = pick([0xd9d2c0, 0xcfc7b4, 0xc5cad0], r), trim = trimOf('commercial');
  const fh = 0.22, z = -0.1;
  const tiers = [[0.7, 0.62, 3], [0.56, 0.5, 3], [0.42, 0.38, 2 + Math.floor(r() * 2)]];
  let y = BASE;
  tiers.forEach(([w, d, n], i) => {
    facadeBlock(g, w, n * fh, d, 0, y, z, { style: 'tower', wall, bay: 0.14, floor: fh });
    y += n * fh;
    band(g, w, d, y - 0.012, trim, 0, z, 0.014, 0.03);
    if (i < 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      // Corner pylons mark each setback
      boxAt(g, 0.05, 0.09, 0.05, M(wall, { r: 0.85 }), sx * (w / 2 - 0.025), y + 0.018, z + sz * (d / 2 - 0.025));
      add(g, taperGeo(0.05, 0.03, 0.05, 0.01, 0.01), trim, sx * (w / 2 - 0.025), y + 0.108, z + sz * (d / 2 - 0.025));
    }
  });
  const [cw, cd] = tiers[2];
  add(g, taperGeo(cw, 0.24, cd, 0.06, 0.06), roofOf('commercial'), 0, y + 0.018, z);
  beacon(g, 0, y + 0.25, z, 0.3);
  // Grand portal
  const zf = z + tiers[0][1] / 2;
  boxAt(g, 0.24, 0.3, 0.03, M(0x4a4640, { r: 0.7 }), 0, BASE, zf + 0.01);
  boxAt(g, 0.14, 0.24, 0.008, MAT.lit(), 0, BASE, zf + 0.026);
  boxAt(g, 0.006, 0.24, 0.012, MAT.darkMetal(), 0, BASE, zf + 0.028);
  boxAt(g, 0.3, 0.02, 0.1, trim, 0, BASE + 0.3, zf + 0.04);
  steps(g, 0.3, 2, 0, BASE, zf + 0.09, MAT.stone(), 0.012, 0.03);
  for (const sx of [-1, 1]) {
    streetLamp(g, sx * 0.47, 0.46, Math.PI);
    planter(g, sx * 0.22, zf + 0.08, BASE, 0x4f8f3a);
  }
  flag(g, -0.34, 0.44, 0xf39c12, 0.45);
  bench(g, 0.3, 0.46, Math.PI);
}

const buildOffice = (g, r) => (r() < 0.55 ? buildGlassTower : buildDecoTower)(g, r);

// ═══════════════════════════════════════════════════════════════════════════
//  INDUSTRIAL
// ═══════════════════════════════════════════════════════════════════════════
const ribbed = hex => M(hex, { r: 0.6, m: 0.3, map: roofPanelTexture() });

/** Striped brick stack with a smoke plume. */
function smokestack(g, x, z, h, rad = 0.055) {
  const white = MAT.white(), red = M(0xb03a2e, { r: 0.8 });
  boxAt(g, rad * 2.6, 0.05, rad * 2.6, MAT.concrete(), x, BASE, z);
  const seg = (h - 0.05) / 5;
  for (let i = 0; i < 5; i++) {
    const t0 = 1 - i * 0.05;
    add(g, G.cyl(rad * (t0 - 0.05), rad * t0, seg, 14), i % 2 ? white : red, x, BASE + 0.05 + seg * (i + 0.5), z);
  }
  add(g, G.torus(rad * 0.86, 0.008, 6, 16), MAT.darkMetal(), x, BASE + h, z, { rx: Math.PI / 2 });
  boxAt(g, 0.012, h * 0.9, 0.006, MAT.darkMetal(), x, BASE + 0.05, z + rad * 0.98);
  smoke(g, x, BASE + h + 0.05, z, rad * 20);
}

function silo(g, x, z, rad, h) {
  const mat = M(0xd9dee2, { r: 0.45, m: 0.5 });
  add(g, G.cyl(rad, rad, h, 16), mat, x, BASE + h / 2 + 0.03, z);
  add(g, G.cone(rad * 1.02, rad * 0.7, 16), mat, x, BASE + h + 0.03 + rad * 0.35, z);
  add(g, G.cyl(rad * 0.8, rad * 0.45, 0.03, 12), MAT.darkMetal(), x, BASE + 0.015, z);
  for (const t of [0.3, 0.65]) add(g, G.cyl(rad + 0.003, rad + 0.003, 0.008, 16), MAT.darkMetal(), x, BASE + 0.03 + h * t, z);
  boxAt(g, 0.014, h, 0.006, MAT.darkMetal(), x, BASE + 0.03, z + rad + 0.002);
}

function pallet(g, x, z, n = 1, y = BASE) {
  boxAt(g, 0.075, 0.014, 0.075, MAT.wood(), x, y, z);
  for (let i = 0; i < n; i++) boxAt(g, 0.064, 0.045, 0.064, M(i % 2 ? 0xb8905a : 0xc8a165, { r: 0.9 }), x, y + 0.014 + i * 0.046, z);
}

function barrels(g, x, z, r) {
  for (const [dx, dz] of [[0, 0], [0.04, 0.012], [0.018, 0.042]]) {
    add(g, G.cyl(0.018, 0.018, 0.05, 8), M(pick([0x2e86de, 0xc0392b, 0xf1c40f, 0x27ae60], r), { r: 0.5, m: 0.3 }), x + dx, BASE + 0.025, z + dz);
  }
}

function forklift(g, x, z, ry = 0) {
  const f = new THREE.Group();
  f.position.set(x, BASE, z); f.rotation.y = ry;
  const yel = M(0xf2b705, { r: 0.5 }), dm = MAT.darkMetal();
  boxAt(f, 0.07, 0.045, 0.1, yel, 0, 0.014, 0);
  boxAt(f, 0.066, 0.03, 0.035, dm, 0, 0.059, -0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(f, 0.004, 0.07, 0.004, dm, sx * 0.03, 0.059, sz * 0.03 - 0.005);
  boxAt(f, 0.07, 0.005, 0.075, dm, 0, 0.129, -0.005);
  for (const sx of [-1, 1]) {
    boxAt(f, 0.006, 0.15, 0.006, dm, sx * 0.022, 0.01, 0.055);
    boxAt(f, 0.01, 0.004, 0.07, MAT.metal(), sx * 0.02, 0.018, 0.095);
    for (const sz of [-0.03, 0.035]) add(f, G.cyl(0.016, 0.016, 0.014, 8), MAT.rubber(), sx * 0.036, 0.016, sz, { rz: Math.PI / 2 });
  }
  pallet(f, 0, 0.1, 1, 0.022);
  g.add(f);
}

/** Lighting mast with two floodlights. */
function floodlight(g, x, z, ry = 0) {
  const f = new THREE.Group();
  f.position.set(x, BASE, z); f.rotation.y = ry;
  add(f, G.cyl(0.008, 0.012, 0.6, 6), MAT.darkMetal(), 0, 0.3, 0);
  boxAt(f, 0.1, 0.008, 0.008, MAT.darkMetal(), 0, 0.59, 0);
  for (const sx of [-1, 1]) {
    add(f, G.box(0.04, 0.03, 0.02), MAT.darkMetal(), sx * 0.035, 0.585, 0.014, { rx: 0.5 });
    add(f, G.box(0.032, 0.022, 0.004), MAT.lit(), sx * 0.035, 0.58, 0.025, { rx: 0.5, shadow: false });
  }
  g.add(f);
}

const sawGeo = (w, h, d) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
};

function buildFactory(g, r) {
  lot(g, 'asphalt', 'industrial');
  const wall = pick([0xa9afb5, 0xb3b8bd, 0xbfb7a8], r), trim = trimOf('industrial');
  const w = 0.66, d = 0.54, h = 0.32, x0 = -0.19, z = -0.16, zf = z + d / 2;
  facadeBlock(g, w, h, d, x0, BASE, z, { style: 'concrete', wall, bay: 0.22, floor: h });
  band(g, w, d, BASE + h - 0.01, trim, x0, z, 0.01, 0.022);
  // North-light sawtooth roof: sloping deck, glazed vertical face
  const teeth = 3, tw = w / teeth, roofM = roofOf('industrial');
  for (let i = 0; i < teeth; i++) {
    const cx = x0 - w / 2 + tw * (i + 0.5);
    add(g, sawGeo(tw, 0.13, d), roofM, cx, BASE + h + 0.012, z);
    boxAt(g, 0.006, 0.1, d * 0.94, MAT.glass(), cx + tw / 2 + 0.001, BASE + h + 0.03, z);
    for (let k = 0; k < 5; k++) boxAt(g, 0.008, 0.1, 0.008, MAT.darkMetal(), cx + tw / 2 + 0.002, BASE + h + 0.03, z - d * 0.47 + k * d * 0.235);
  }
  // Loading doors under a canopy
  for (const dx of [-0.17, 0.1]) {
    texturedPanel(g, 0.18, 0.2, shutterTexture(0xd1b25a), x0 + dx, BASE + 0.1, zf + 0.004);
    for (const sx of [-1, 1]) boxAt(g, 0.014, 0.05, 0.014, M(0xf1c40f, { r: 0.6 }), x0 + dx + sx * 0.11, BASE, zf + 0.03);
  }
  boxAt(g, w * 0.86, 0.012, 0.09, MAT.darkMetal(), x0, BASE + 0.225, zf + 0.045);
  // Brick office annex
  const xa = 0.34, za = 0.0;
  facadeBlock(g, 0.3, 0.44, 0.26, xa, BASE, za, { style: 'brick', wall: pick(BRICKS, r), bay: 0.15, floor: 0.22, roofMat: roofM });
  band(g, 0.3, 0.26, BASE + 0.44, MAT.stone(), xa, za, 0.012, 0.022);
  boxAt(g, 0.07, 0.15, 0.008, MAT.darkGlass(), xa, BASE, za + 0.134);
  boxAt(g, 0.12, 0.012, 0.05, trim, xa, BASE + 0.16, za + 0.155);
  acUnit(g, xa + 0.05, BASE + 0.462, za - 0.04, 0.9);
  // Process plant behind: silos feeding the hall, and the main stack
  silo(g, 0.24, -0.38, 0.07, 0.36);
  add(g, G.box(0.03, 0.02, 0.2), MAT.metal(), 0.19, BASE + 0.42, -0.36, { ry: Math.PI / 2, rz: 0.25 });
  smokestack(g, 0.44, -0.4, 1.1);
  add(g, G.cyl(0.02, 0.02, 0.3, 8), MAT.metal(), x0 + w / 2 + 0.022, BASE + 0.15, z - 0.1);
  add(g, G.cyl(0.02, 0.02, 0.1, 8), MAT.metal(), x0 + w / 2 + 0.07, BASE + 0.29, z - 0.1, { rz: Math.PI / 2 });
  // Yard
  const stripe = M(0xf1c40f, { r: 0.6 });
  for (let i = 0; i < 4; i++) boxAt(g, 0.012, 0.003, 0.15, stripe, -0.47 + i * 0.13, BASE, 0.42, { shadow: false });
  const truck = vehicle('truck', pick([0x2980b9, 0xecf0f1, 0xc0392b], r), r);
  truck.position.set(-0.28, BASE, 0.4); truck.rotation.y = Math.PI / 2; truck.scale.setScalar(0.8);
  g.add(truck);
  pallet(g, 0.12, 0.3, 2); pallet(g, 0.21, 0.31, 1);
  barrels(g, 0.42, 0.24, r);
  boxAt(g, 0.11, 0.06, 0.07, M(0x2f6b3b, { r: 0.7 }), 0.4, BASE, 0.44);
  boxAt(g, 0.115, 0.008, 0.075, MAT.darkMetal(), 0.4, BASE + 0.06, 0.44);
  fence(g, -L2 + 0.05, -L2 + 0.05, 0.12, -L2 + 0.05, 'chain', BASE);
  fence(g, -L2 + 0.05, -L2 + 0.05, -L2 + 0.05, 0.2, 'chain', BASE);
}

function container(g, x, y, z, ry, color) {
  const c = new THREE.Group();
  c.position.set(x, y, z); c.rotation.y = ry;
  boxAt(c, 0.26, 0.1, 0.1, ribbed(color), 0, 0, 0);
  boxAt(c, 0.264, 0.008, 0.104, MAT.darkMetal(), 0, 0, 0);
  boxAt(c, 0.264, 0.006, 0.104, MAT.darkMetal(), 0, 0.097, 0);
  for (const dz of [-0.022, 0.022]) boxAt(c, 0.004, 0.085, 0.004, MAT.metal(), 0.131, 0.008, dz);
  g.add(c);
}

function buildWarehouse(g, r) {
  lot(g, 'asphalt', 'industrial');
  const wall = pick([0xa9afb5, 0xb3b8bd, 0xc2b9a7], r), trim = trimOf('industrial');
  const w = 0.92, d = 0.5, h = 0.34, z = -0.25, zf = z + d / 2;
  facadeBlock(g, w, h, d, 0, BASE, z, { style: 'concrete', wall, bay: 0.23, floor: h, top: false });
  // Shallow pitched roof with ridge ventilators
  add(g, prismGeo(d + 0.05, 0.1, w + 0.04), roofOf('industrial'), 0, BASE + h, z, { ry: Math.PI / 2 });
  band(g, w, d, BASE + h - 0.014, trim, 0, z, 0.014, 0.02);
  for (const dx of [-0.28, 0, 0.28]) {
    add(g, G.cyl(0.03, 0.03, 0.03, 10), MAT.metal(), dx, BASE + h + 0.11, z);
    add(g, G.sphere(0.034, 10, 6), MAT.metal(), dx, BASE + h + 0.125, z, { s: [1, 0.6, 1] });
  }
  texturedPanel(g, 0.36, 0.07, signTexture(pick(['DEPOT', 'FREIGHT', 'STORAGE', 'CARGO'], r), 0x6c3483), 0, BASE + 0.29, zf + 0.004, 0, 0.5);
  // Loading dock: platform, three doors with bumpers and canopies
  boxAt(g, w * 0.86, 0.05, 0.08, MAT.concrete(), 0, BASE, zf + 0.04);
  for (const dx of [-0.27, 0, 0.27]) {
    texturedPanel(g, 0.18, 0.19, shutterTexture(), dx, BASE + 0.145, zf + 0.004);
    boxAt(g, 0.21, 0.012, 0.06, MAT.darkMetal(), dx, BASE + 0.245, zf + 0.03);
    for (const sx of [-1, 1]) boxAt(g, 0.016, 0.03, 0.012, MAT.rubber(), dx + sx * 0.07, BASE + 0.015, zf + 0.086);
  }
  steps(g, 0.06, 2, w * 0.43 + 0.03, BASE, zf + 0.07, MAT.concrete(), 0.025, 0.035);
  // Truck backed onto a dock, containers, forklift
  const truck = vehicle('truck', null, r);
  truck.position.set(-0.27, BASE, zf + 0.31); truck.scale.setScalar(0.8);
  g.add(truck);
  const cols = [0xc0392b, 0x2980b9, 0x27ae60, 0xe67e22, 0x8e44ad, 0x16a085];
  container(g, 0.4, BASE, 0.3, Math.PI / 2, pick(cols, r));
  container(g, 0.285, BASE, 0.32, Math.PI / 2, pick(cols, r));
  container(g, 0.34, BASE + 0.103, 0.31, Math.PI / 2, pick(cols, r));
  forklift(g, 0.04, 0.34, -0.5);
  pallet(g, 0.1, 0.46, 2); pallet(g, -0.02, 0.47, 1);
  barrels(g, -0.48, 0.2, r);
  floodlight(g, -0.48, 0.47, Math.PI * 0.75);
  fence(g, -L2 + 0.05, -L2 + 0.045, L2 - 0.05, -L2 + 0.045, 'chain', BASE);
}

function tank(g, x, z, rad, h, mat) {
  add(g, G.cyl(rad + 0.012, rad + 0.012, 0.012, 20), MAT.concrete(), x, BASE + 0.006, z);
  add(g, G.cyl(rad, rad, h, 20), mat, x, BASE + h / 2, z);
  add(g, G.sphere(rad, 20, 8), mat, x, BASE + h, z, { s: [1, 0.22, 1] });
  add(g, G.cyl(rad + 0.004, rad + 0.004, h * 0.16, 20), trimOf('industrial'), x, BASE + h * 0.72, z);
  add(g, G.torus(rad * 0.94, 0.004, 4, 20), MAT.darkMetal(), x, BASE + h + 0.03, z, { rx: Math.PI / 2 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    boxAt(g, 0.004, 0.03, 0.004, MAT.darkMetal(), x + Math.cos(a) * rad * 0.94, BASE + h, z + Math.sin(a) * rad * 0.94);
  }
  // Stair run climbing the shell
  add(g, G.box(0.014, 0.008, h * 1.15), MAT.darkMetal(), x + rad + 0.008, BASE + h / 2, z, { rx: -1.05 });
  add(g, G.cyl(0.03, 0.03, 0.02, 8), MAT.darkMetal(), x, BASE + h + rad * 0.22, z);
}

function buildRefinery(g, r) {
  lot(g, 'asphalt', 'industrial');
  const tankM = M(pick([0xe8e8e8, 0xd7dde2], r), { r: 0.4, m: 0.4 });
  const steel = M(0xc3c9cf, { r: 0.35, m: 0.7 }), dm = MAT.darkMetal();
  // Bunded tank farm
  boxAt(g, 0.66, 0.01, 0.4, M(0x8f8c84, { r: 1 }), -0.2, BASE, -0.32, { shadow: false });
  for (const [bw, bd, bx, bz] of [[0.66, 0.012, -0.2, -0.12], [0.012, 0.4, 0.13, -0.32]]) boxAt(g, bw, 0.03, bd, MAT.concrete(), bx, BASE, bz);
  tank(g, -0.33, -0.33, 0.16, 0.36, tankM);
  tank(g, -0.02, -0.36, 0.12, 0.3, tankM);
  // Pressure sphere on legs
  const sx0 = -0.36, sz0 = 0.16;
  add(g, G.sphere(0.1, 16, 10), tankM, sx0, BASE + 0.15, sz0);
  add(g, G.cyl(0.101, 0.101, 0.012, 16), trimOf('industrial'), sx0, BASE + 0.15, sz0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.78;
    add(g, G.cyl(0.008, 0.008, 0.15, 5), dm, sx0 + Math.cos(a) * 0.08, BASE + 0.075, sz0 + Math.sin(a) * 0.08);
  }
  // Distillation columns with access platforms
  for (const [x, z, h, rad] of [[0.3, -0.36, 0.86, 0.045], [0.43, -0.22, 0.62, 0.035]]) {
    add(g, G.cyl(rad, rad * 1.1, h, 12), steel, x, BASE + h / 2, z);
    add(g, G.sphere(rad, 12, 6), steel, x, BASE + h, z, { s: [1, 0.5, 1] });
    for (const t of [0.35, 0.62, 0.86]) {
      add(g, G.cyl(rad + 0.03, rad + 0.03, 0.006, 12), dm, x, BASE + h * t, z);
      add(g, G.torus(rad + 0.03, 0.003, 4, 12), dm, x, BASE + h * t + 0.03, z, { rx: Math.PI / 2 });
    }
    boxAt(g, 0.012, h * 0.86, 0.005, dm, x, BASE, z + rad + 0.004);
    add(g, G.cyl(0.008, 0.008, h * 0.7, 6), M(0xd35400, { r: 0.5, m: 0.4 }), x - rad - 0.008, BASE + h * 0.5, z);
  }
  // Pipe rack running from the tanks to the process area
  for (const x of [-0.14, 0.06, 0.26, 0.44]) {
    boxAt(g, 0.012, 0.21, 0.012, dm, x, BASE, 0.0);
    boxAt(g, 0.012, 0.21, 0.012, dm, x, BASE, 0.07);
    boxAt(g, 0.012, 0.01, 0.082, dm, x, BASE + 0.2, 0.035);
  }
  [[0.215, 0xd35400, 0.01], [0.215, 0xf1c40f, 0.035], [0.215, 0x7f8c8d, 0.06], [0.15, 0xc3c9cf, 0.035]].forEach(([y, c, z]) =>
    add(g, G.cyl(0.011, 0.011, 0.62, 8), M(c, { r: 0.5, m: 0.4 }), 0.15, BASE + y + 0.005, z, { rz: Math.PI / 2 }));
  for (const z of [0.01, 0.035]) add(g, G.cyl(0.011, 0.011, 0.14, 8), M(0x7f8c8d, { r: 0.5, m: 0.4 }), -0.16, BASE + 0.15, z - 0.07, { rx: Math.PI / 2 });
  // Control building
  facadeBlock(g, 0.32, 0.2, 0.2, 0.3, BASE, 0.34, { style: 'office', wall: 0xd0d3d4, bay: 0.16, floor: 0.2, roofMat: roofOf('industrial') });
  band(g, 0.32, 0.2, BASE + 0.2, MAT.white(), 0.3, 0.34, 0.012, 0.016);
  acUnit(g, 0.36, BASE + 0.216, 0.33, 0.8);
  satelliteDish(g, 0.22, BASE + 0.216, 0.34, 2.4, 0.8);
  // Flare stack
  add(g, G.cyl(0.014, 0.024, 0.95, 8), dm, 0.46, BASE + 0.475, 0.1);
  for (const t of [0.3, 0.6]) add(g, G.torus(0.03, 0.003, 4, 10), dm, 0.46, BASE + 0.95 * t, 0.1, { rx: Math.PI / 2 });
  const flame = add(g, G.cone(0.03, 0.09, 8), M(0xffa21a, { e: 0xff6a00, ei: 2 }), 0.46, BASE + 1.0, 0.1, { shadow: false });
  flame.userData.noBake = true;
  anim(g, t => { const s = 0.8 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1; flame.scale.set(s, s * 1.2, s); });
  // Tanker and yard clutter
  const tanker = vehicle('truck', 0xecf0f1, r);
  tanker.position.set(-0.08, BASE, 0.4); tanker.rotation.y = -Math.PI / 2; tanker.scale.setScalar(0.78);
  g.add(tanker);
  barrels(g, -0.2, 0.2, r);
  for (let i = 0; i < 8; i++) boxAt(g, 0.06, 0.004, 0.022, M(i % 2 ? 0x2b2b2b : 0xf1c40f), -0.5 + i * 0.062, BASE, 0.5, { shadow: false });
}

// ═══════════════════════════════════════════════════════════════════════════
//  POWER PLANT
// ═══════════════════════════════════════════════════════════════════════════
function transformer(g, x, z) {
  boxAt(g, 0.08, 0.075, 0.06, MAT.darkMetal(), x, BASE + 0.01, z);
  boxAt(g, 0.09, 0.01, 0.07, MAT.concrete(), x, BASE, z);
  for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) boxAt(g, 0.004, 0.055, 0.012, MAT.metal(), x - 0.03 + i * 0.02, BASE + 0.02, z + sz * 0.036);
  for (const dx of [-0.024, 0, 0.024]) {
    add(g, G.cyl(0.004, 0.006, 0.04, 6), M(0xd8c690, { r: 0.6 }), x + dx, BASE + 0.105, z);
    add(g, G.cyl(0.008, 0.008, 0.005, 6), M(0x8a6b4a), x + dx, BASE + 0.105, z);
  }
}

/** Lattice transmission tower. */
function pylon(g, x, z, h = 0.62, ry = 0) {
  const p = new THREE.Group();
  p.position.set(x, BASE, z); p.rotation.y = ry;
  const steel = MAT.metal(), b = 0.055, t = 0.012, lean = Math.atan2(b - t, h);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(p, G.cyl(0.004, 0.005, h, 4), steel, sx * (b + t) / 2, h / 2, sz * (b + t) / 2, { rz: sx * lean, rx: -sz * lean });
  }
  for (const k of [0.18, 0.38, 0.56, 0.72]) {
    const s = (b + (t - b) * k) * 2;
    for (const sg of [-1, 1]) {
      boxAt(p, s, 0.004, 0.004, steel, 0, h * k, sg * s / 2);
      boxAt(p, 0.004, 0.004, s, steel, sg * s / 2, h * k, 0);
    }
  }
  for (const [k, len] of [[0.78, 0.22], [0.93, 0.16]]) {
    boxAt(p, len, 0.006, 0.006, steel, 0, h * k, 0);
    for (const sx of [-1, 1]) add(p, G.cyl(0.004, 0.004, 0.03, 5), M(0x7fb0c8, { r: 0.3 }), sx * (len / 2 - 0.006), h * k - 0.015, 0);
  }
  g.add(p);
  return h;
}

function buildPower(g, r) {
  lot(g, 'asphalt', 'power');
  const trim = trimOf('power');
  const shell = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.95, side: THREE.DoubleSide });
  for (const [x, z] of [[-0.27, -0.24], [0.17, -0.3]]) {
    const t = add(g, coolingTowerGeo(0.22, 0.15, 0.17, 0.85), shell, x, BASE + 0.03, z);
    t.userData.noBake = true;
    t.userData.ownsMaterial = true;
    // Ring beam on raking legs, painted bands and rim
    add(g, G.cyl(0.235, 0.24, 0.012, 24), MAT.concrete(), x, BASE + 0.006, z);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      add(g, G.cyl(0.006, 0.006, 0.05, 4), MAT.concrete(), x + Math.cos(a) * 0.222, BASE + 0.03, z + Math.sin(a) * 0.222, { rz: (i % 2 ? 1 : -1) * 0.5 * Math.sin(a), rx: (i % 2 ? 1 : -1) * 0.5 * Math.cos(a) });
    }
    add(g, G.torus(0.168, 0.01, 4, 24), M(0xb03a2e), x, BASE + 0.85, z, { rx: Math.PI / 2 });
    add(g, G.torus(0.152, 0.006, 4, 24), trim, x, BASE + 0.6, z, { rx: Math.PI / 2 });
    smoke(g, x, BASE + 0.93, z, 2.2, 6);
  }
  // Turbine hall with twin flues
  const xh = -0.17, zh = 0.28;
  facadeBlock(g, 0.5, 0.26, 0.24, xh, BASE, zh, { style: 'concrete', wall: 0x9aa5ab, bay: 0.125, floor: 0.26, roofMat: roofOf('power') });
  band(g, 0.5, 0.24, BASE + 0.26, trim, xh, zh, 0.012, 0.025);
  texturedPanel(g, 0.14, 0.15, shutterTexture(0xd9dde0), xh + 0.12, BASE + 0.075, zh + 0.124);
  boxAt(g, 0.05, 0.12, 0.006, M(0x3d4f5c, { r: 0.6 }), xh - 0.14, BASE, zh + 0.122);
  for (const dx of [-0.16, -0.06]) {
    add(g, G.cyl(0.018, 0.022, 0.26, 10), MAT.metal(), xh + dx, BASE + 0.39, zh - 0.05);
    add(g, G.cyl(0.02, 0.02, 0.02, 10), M(0xb03a2e), xh + dx, BASE + 0.5, zh - 0.05);
  }
  acUnit(g, xh + 0.14, BASE + 0.285, zh - 0.02, 0.9);
  // Steam mains back to the towers
  for (const dx of [-0.1, 0.1]) {
    add(g, G.cyl(0.018, 0.018, 0.2, 8), MAT.metal(), xh + dx, BASE + 0.1, zh - 0.2, { rx: Math.PI / 2 });
    add(g, G.cyl(0.022, 0.022, 0.012, 8), M(0xb03a2e), xh + dx, BASE + 0.1, zh - 0.2, { rx: Math.PI / 2 });
  }
  // Switchyard: transformers, gantry and a pylon carrying the lines out
  boxAt(g, 0.34, 0.008, 0.42, M(0x9b9b8f, { r: 1 }), 0.33, BASE, 0.25, { shadow: false });
  for (const [x, z] of [[0.24, 0.12], [0.36, 0.12], [0.24, 0.26]]) transformer(g, x, z);
  const h = pylon(g, 0.4, 0.4, 0.62);
  for (const z of [0.06, 0.2]) {
    boxAt(g, 0.01, 0.2, 0.01, MAT.metal(), 0.46, BASE, z);
    boxAt(g, 0.01, 0.01, 0.1, MAT.metal(), 0.46, BASE + 0.19, z);
  }
  boxAt(g, 0.004, 0.004, 0.15, MAT.darkMetal(), 0.46, BASE + 0.195, 0.13);
  for (const sx of [-1, 1]) {
    add(g, G.box(0.003, 0.003, 0.36), MAT.darkMetal(), 0.4 + sx * 0.1, BASE + h * 0.6, 0.25, { rx: -0.85 });
    add(g, G.box(0.003, 0.003, 0.17), MAT.darkMetal(), 0.4 + sx * 0.1, BASE + h * 0.76, 0.48, { rx: 0.25 });
  }
  fence(g, 0.15, 0.03, 0.15, 0.47, 'chain', BASE);
  fence(g, 0.15, 0.03, L2 - 0.05, 0.03, 'chain', BASE);
  // Warning sign and hazard edge
  boxAt(g, 0.006, 0.08, 0.006, MAT.metal(), 0.15, BASE, 0.5);
  boxAt(g, 0.05, 0.045, 0.004, M(0xf1c40f, { r: 0.5 }), 0.15, BASE + 0.07, 0.502);
  for (let i = 0; i < 9; i++) boxAt(g, 0.06, 0.004, 0.022, M(i % 2 ? 0x2b2b2b : 0xf1c40f), -0.5 + i * 0.065, BASE, 0.5, { shadow: false });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SERVICES
// ═══════════════════════════════════════════════════════════════════════════
function swingSet(g, x, z, ry = 0) {
  const s = new THREE.Group();
  s.position.set(x, BASE, z); s.rotation.y = ry;
  const blue = M(0x2980b9, { r: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(s, G.cyl(0.004, 0.004, 0.135, 4), blue, sx * 0.08, 0.063, sz * 0.025, { rx: -sz * 0.38 });
  add(s, G.cyl(0.004, 0.004, 0.17, 4), blue, 0, 0.125, 0, { rz: Math.PI / 2 });
  for (const dx of [-0.035, 0.035]) {
    for (const o of [-0.012, 0.012]) boxAt(s, 0.002, 0.085, 0.002, MAT.darkMetal(), dx + o, 0.04, 0);
    boxAt(s, 0.03, 0.004, 0.014, M(0xe74c3c), dx, 0.036, 0);
  }
  g.add(s);
}

function slide(g, x, z, ry = 0) {
  const s = new THREE.Group();
  s.position.set(x, BASE, z); s.rotation.y = ry;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(s, 0.006, 0.11, 0.006, M(0xe74c3c), sx * 0.028, 0, sz * 0.028);
  boxAt(s, 0.07, 0.008, 0.07, MAT.wood(), 0, 0.085, 0);
  add(s, G.cone(0.06, 0.04, 4), M(0x2e86de), 0, 0.15, 0, { ry: Math.PI / 4 });
  add(s, G.box(0.045, 0.006, 0.17), M(0xf1c40f, { m: 0.3, r: 0.4 }), 0, 0.045, 0.1, { rx: 0.52 });
  for (let i = 0; i < 4; i++) boxAt(s, 0.04, 0.004, 0.006, MAT.metal(), 0, 0.02 + i * 0.02, -0.04 - (3 - i) * 0.008);
  g.add(s);
}

function hoop(g, x, z, ry = 0) {
  const s = new THREE.Group();
  s.position.set(x, BASE, z); s.rotation.y = ry;
  boxAt(s, 0.008, 0.13, 0.008, MAT.darkMetal(), 0, 0, 0);
  boxAt(s, 0.06, 0.04, 0.004, MAT.white(), 0, 0.11, 0.008);
  add(s, G.torus(0.014, 0.002, 4, 10), M(0xe67e22), 0, 0.115, 0.026, { rx: Math.PI / 2 });
  g.add(s);
}

function buildSchool(g, r) {
  lot(g, 'grass', 'school');
  const brick = r() < 0.6;
  const wall = brick ? pick([0xb5654a, 0xa0523d], r) : 0xf0dc9a, style = brick ? 'brick' : 'stone';
  const trim = trimOf('school'), fh = 0.23, h = fh * 2;
  // Main range across the back and a classroom wing coming forward
  facadeBlock(g, 0.84, h, 0.34, 0, BASE, -0.32, { style, wall, bay: 0.168, floor: fh, roofMat: roofOf('school') });
  facadeBlock(g, 0.28, h, 0.32, -0.28, BASE, 0.0, { style, wall, bay: 0.16, floor: fh, roofMat: roofOf('school') });
  band(g, 0.84, 0.34, BASE + fh - 0.01, MAT.stone(), 0, -0.32, 0.01, 0.02);
  band(g, 0.84, 0.34, BASE + h, trim, 0, -0.32, 0.02, 0.03);
  band(g, 0.28, 0.32, BASE + h, trim, -0.28, 0.0, 0.02, 0.03);
  rooftop(g, 0.5, 0.26, BASE + h + 0.03, r, 0.14, -0.34);
  // Clock tower over the entrance
  const tx = 0.14, tz = -0.17, th = 0.74;
  facadeBlock(g, 0.18, th, 0.18, tx, BASE, tz, { style, wall, bay: 0.18, floor: th, top: false });
  boxAt(g, 0.181, 0.42, 0.181, M(wall, { r: 0.85 }), tx, BASE + 0.08, tz);   // plain shaft, windows only at the top
  band(g, 0.18, 0.18, BASE + th - 0.2, MAT.stone(), tx, tz, 0.012, 0.02);
  band(g, 0.18, 0.18, BASE + th, MAT.stone(), tx, tz, 0.018, 0.022);
  boxAt(g, 0.184, 0.15, 0.184, M(wall, { r: 0.85 }), tx, BASE + th - 0.175, tz);
  for (const [dx, dz, ry] of [[0, 0.093, 0], [0.093, 0, Math.PI / 2], [-0.093, 0, -Math.PI / 2]]) {
    texturedPanel(g, 0.11, 0.11, clockTexture(), tx + dx, BASE + th - 0.1, tz + dz, ry, 0.3);
  }
  add(g, taperGeo(0.22, 0.16, 0.22, 0.012, 0.012), roofOf('school'), tx, BASE + th + 0.022, tz);
  add(g, G.sphere(0.014, 8, 6), M(0xd4af37, { m: 0.8, r: 0.3 }), tx, BASE + th + 0.19, tz);
  // Entrance
  const zf = tz + 0.09;
  boxAt(g, 0.11, 0.17, 0.008, MAT.darkGlass(), tx, BASE + 0.02, zf + 0.004);
  boxAt(g, 0.006, 0.17, 0.012, MAT.white(), tx, BASE + 0.02, zf + 0.005);
  boxAt(g, 0.3, 0.022, 0.13, MAT.white(), tx, BASE + 0.2, zf + 0.065);
  for (const sx of [-1, 1]) add(g, G.cyl(0.011, 0.013, 0.18, 8), MAT.white(), tx + sx * 0.12, BASE + 0.11, zf + 0.11);
  texturedPanel(g, 0.28, 0.055, signTexture('SCHOOL', 0x128f76), tx, BASE + 0.2495, zf + 0.131, 0, 0.4);
  boxAt(g, 0.29, 0.06, 0.008, M(0x128f76), tx, BASE + 0.222, zf + 0.126);
  steps(g, 0.3, 2, tx, BASE, zf + 0.12, MAT.concrete(), 0.01, 0.035);
  ground(g, 'paved', 0.2, 0.2, tx, zf + 0.22);
  // Sports court with hoops
  add(g, G.plane(0.36, 0.28), M(0xffffff, { map: fieldTexture(), r: 1 }), 0.2, BASE + 0.004, 0.36, { rx: -Math.PI / 2, shadow: false });
  hoop(g, 0.03, 0.36, Math.PI / 2);
  hoop(g, 0.37, 0.36, -Math.PI / 2);
  // Playground on soft surfacing
  boxAt(g, 0.36, 0.006, 0.28, M(0xc98a5a, { r: 1 }), -0.3, BASE, 0.36, { shadow: false });
  slide(g, -0.4, 0.3, 0.3);
  swingSet(g, -0.24, 0.42);
  boxAt(g, 0.09, 0.012, 0.09, MAT.wood(), -0.2, BASE, 0.27);
  boxAt(g, 0.075, 0.014, 0.075, M(0xe6d3a3, { r: 1 }), -0.2, BASE, 0.27, { shadow: false });
  fence(g, -L2 + 0.05, L2 - 0.045, -0.1, L2 - 0.045, 'picket', BASE);
  // School bus at the kerb, flag, bikes, trees
  const bus = vehicle('bus', 0xf5b700, r);
  bus.position.set(0.475, BASE, 0.22); bus.scale.setScalar(0.6);
  g.add(bus);
  flag(g, 0.34, -0.06, 0x2c3e50, 0.5);
  bikeRack(g, -0.04, -0.08, 0, r);
  tree(g, 0.47, -0.08, 0.6, pick(['round', 'blossom'], r), r);
  tree(g, -0.48, 0.1, 0.55, 'round', r);
}

function ducks(g, cx, cz, rad, n = 2) {
  for (let i = 0; i < n; i++) {
    const duck = new THREE.Group();
    add(duck, G.sphere(0.018, 8, 6), MAT.white(), 0, 0.01, 0, { s: [1, 0.8, 1.3] });
    add(duck, G.sphere(0.01, 6, 4), M(0x2f6b3b), 0, 0.026, 0.016);
    add(duck, G.cone(0.004, 0.01, 4), M(0xf39c12), 0, 0.025, 0.028, { rx: Math.PI / 2 });
    duck.userData.noBake = true;
    g.add(duck);
    const ph = i * Math.PI * 2 / n, sp = 0.3 - i * 0.05, rr = rad * (1 - i * 0.25);
    anim(g, t => {
      const a = t * sp + ph;
      duck.position.set(cx + Math.cos(a) * rr, BASE + 0.008, cz + Math.sin(a) * rr);
      duck.rotation.y = -a;
    });
  }
}

function parkPond(g, r) {
  const px = 0.1, pz = -0.1, path = 'paved';
  add(g, G.circle(0.27, 28), M(0xcdbf99, { r: 1 }), px, BASE + 0.003, pz, { shadow: false, s: [1.15, 1, 0.95] });
  add(g, G.circle(0.24, 28), MAT.water(), px, BASE + 0.007, pz, { shadow: false, s: [1.15, 1, 0.95] });
  // Rocks, reeds and lily pads round the margin
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.283;
    rock(g, px + Math.cos(a) * 0.29, pz + Math.sin(a) * 0.24, 0.5 + r() * 0.5, r).position.y += BASE;
  }
  for (let i = 0; i < 12; i++) {
    const a = 2.2 + r() * 2.2, d = 0.2 + r() * 0.05;
    add(g, G.cone(0.004, 0.07 + r() * 0.04, 4), M(0x4f8f3a, { flat: true, r: 0.9 }), px + Math.cos(a) * d * 1.15, BASE + 0.04, pz + Math.sin(a) * d * 0.95, { shadow: false });
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.283, d = 0.05 + r() * 0.14;
    const lx = px + Math.cos(a) * d, lz = pz + Math.sin(a) * d;
    add(g, G.circle(0.02, 8), M(0x3f8a44, { r: 0.8 }), lx, BASE + 0.009, lz, { shadow: false });
    if (i % 2) add(g, G.ico(0.008, 0), M(0xf7b6cf, { flat: true }), lx, BASE + 0.016, lz, { shadow: false });
  }
  ducks(g, px, pz, 0.13, 3);
  // Timber jetty
  boxAt(g, 0.06, 0.008, 0.16, MAT.wood(), px + 0.02, BASE + 0.02, pz + 0.24);
  for (const sx of [-1, 1]) for (const dz of [0.18, 0.3]) boxAt(g, 0.008, 0.035, 0.008, MAT.wood(), px + 0.02 + sx * 0.028, BASE, pz + dz);
  ground(g, path, LOT - 0.08, 0.08, 0, 0.36);
  ground(g, path, 0.08, 0.5, -0.36, 0.11);
  bench(g, -0.12, 0.29);
  bench(g, 0.34, 0.29);
  trashBin(g, 0.11, 0.3, BASE);
  flowerBed(g, -0.14, 0.44, 0.3, 0.06, r);
  streetLamp(g, -0.3, 0.44, Math.PI);
  tree(g, -0.4, -0.38, 1.05, 'oak', r);
  tree(g, 0.44, -0.42, 0.9, 'tall', r);
  tree(g, 0.43, 0.46, 0.8, pick(['round', 'autumn', 'blossom'], r), r);
  tree(g, -0.47, 0.46, 0.7, 'birch', r);
}

function parkFountain(g, r) {
  add(g, G.circle(0.34, 32), SURF.paved(), 0, BASE + 0.004, 0, { shadow: false });
  ground(g, 'paved', LOT - 0.08, 0.1, 0, 0);
  ground(g, 'paved', 0.1, LOT - 0.08, 0, 0);
  // Two-tier fountain
  add(g, G.cyl(0.18, 0.19, 0.05, 24), MAT.stone(), 0, BASE + 0.025, 0);
  add(g, G.cyl(0.16, 0.16, 0.052, 24), MAT.water(), 0, BASE + 0.026, 0);
  add(g, G.cyl(0.022, 0.034, 0.13, 10), MAT.stone(), 0, BASE + 0.095, 0);
  add(g, G.cyl(0.085, 0.04, 0.022, 16), MAT.stone(), 0, BASE + 0.165, 0);
  add(g, G.cyl(0.075, 0.075, 0.024, 16), MAT.water(), 0, BASE + 0.166, 0);
  add(g, G.cyl(0.012, 0.018, 0.07, 8), MAT.stone(), 0, BASE + 0.21, 0);
  add(g, G.cyl(0.04, 0.018, 0.014, 12), MAT.stone(), 0, BASE + 0.25, 0);
  const jetM = M(0xd6f0ff, { opacity: 0.7, r: 0.1 });
  const jet = add(g, G.cone(0.02, 0.1, 8), jetM, 0, BASE + 0.3, 0, { shadow: false });
  const veil = add(g, G.cyl(0.078, 0.15, 0.13, 16, 1, true), jetM, 0, BASE + 0.1, 0, { shadow: false });
  jet.userData.noBake = veil.userData.noBake = true;
  anim(g, t => { jet.scale.y = 0.85 + Math.sin(t * 6) * 0.15; veil.scale.x = veil.scale.z = 1 + Math.sin(t * 4.3) * 0.03; });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    tree(g, sx * 0.4, sz * 0.4, 0.85, pick(['round', 'round', 'blossom', 'autumn'], r), r);
    flowerBed(g, sx * 0.3, sz * 0.17, 0.2, 0.05, r);
    flowerBed(g, sx * 0.17, sz * 0.32, 0.05, 0.16, r);
    hedge(g, 0.26, 0.035, sx * 0.39, sz * 0.5);
  }
  bench(g, 0.26, 0.09, -Math.PI / 2);
  bench(g, -0.26, -0.09, Math.PI / 2);
  bench(g, 0.09, -0.26, 0);
  bench(g, -0.09, 0.26, Math.PI);
  streetLamp(g, 0.1, 0.46, Math.PI);
  streetLamp(g, -0.1, -0.46, 0);
  trashBin(g, 0.24, -0.1, BASE);
}

function parkWoodland(g, r) {
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    ground(g, 'paved', 0.09, 0.15, Math.sin(t * Math.PI * 1.5) * 0.18, -L2 + 0.1 + t * (LOT - 0.2), BASE, 0.005, { ry: Math.cos(t * Math.PI * 1.5) * 0.5 });
  }
  const spots = [[-0.4, -0.4], [-0.42, 0.02], [-0.38, 0.4], [0.42, -0.42], [0.4, -0.04], [0.42, 0.4], [-0.16, -0.24], [0.22, 0.2], [0.14, -0.42]];
  for (const [x, z] of spots) {
    tree(g, x + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.06, 0.8 + r() * 0.4, pick(['round', 'pine', 'oak', 'pine', 'birch', 'autumn', 'tall'], r), r);
  }
  for (let i = 0; i < 6; i++) bush(g, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9, 0.7 + r() * 0.3, pick([0x4f8f3a, 0x3f7d36, 0x5fa043], r));
  for (let i = 0; i < 4; i++) rock(g, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8, 0.5 + r() * 0.6, r).position.y += BASE;
  // Fallen log, toadstools, picnic spot
  add(g, G.cyl(0.02, 0.024, 0.16, 7), MAT.trunk(), 0.24, BASE + 0.022, -0.2, { rz: Math.PI / 2, ry: 0.6 });
  for (const [mx, mz] of [[0.2, -0.13], [0.24, -0.12], [-0.3, 0.2]]) {
    add(g, G.cyl(0.004, 0.004, 0.016, 5), MAT.white(), mx, BASE + 0.008, mz, { shadow: false });
    add(g, G.cone(0.011, 0.01, 6), M(0xd63a2f, { r: 0.6 }), mx, BASE + 0.02, mz, { shadow: false });
  }
  picnicTable(g, -0.14, 0.34, 0.3).position.y = BASE;
  bench(g, 0.06, 0.02, Math.PI / 2);
  trashBin(g, -0.02, 0.42, BASE);
}

function parkPlayground(g, r) {
  boxAt(g, 0.7, 0.006, 0.6, M(0xd08c5b, { r: 1 }), 0, BASE, -0.04, { shadow: false });
  boxAt(g, 0.26, 0.007, 0.24, M(0x4aa3a0, { r: 1 }), -0.18, BASE, -0.16, { shadow: false });
  slide(g, -0.2, -0.2, 0.4);
  swingSet(g, 0.18, -0.24);
  // Roundabout that keeps spinning
  const spin = new THREE.Group();
  spin.userData.noBake = true;
  spin.position.set(0.2, BASE, 0.08);
  add(spin, G.cyl(0.07, 0.07, 0.012, 12), M(0xe74c3c, { r: 0.6 }), 0, 0.022, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    add(spin, G.cyl(0.003, 0.003, 0.05, 4), M(0xf1c40f), Math.cos(a) * 0.055, 0.05, Math.sin(a) * 0.055);
  }
  add(spin, G.torus(0.055, 0.003, 4, 12), M(0xf1c40f), 0, 0.075, 0, { rx: Math.PI / 2 });
  g.add(spin);
  anim(g, t => { spin.rotation.y = t * 0.9; });
  // Seesaw
  add(g, G.cone(0.016, 0.03, 4), M(0x2e86de), -0.14, BASE + 0.015, 0.12);
  const saw = add(g, G.box(0.18, 0.006, 0.02), M(0xf1c40f, { r: 0.6 }), -0.14, BASE + 0.034, 0.12);
  saw.userData.noBake = true;
  anim(g, t => { saw.rotation.z = Math.sin(t * 1.6) * 0.22; });
  // Sandpit
  boxAt(g, 0.16, 0.016, 0.13, MAT.wood(), 0.04, BASE, 0.17);
  boxAt(g, 0.14, 0.018, 0.11, M(0xe6d3a3, { r: 1 }), 0.04, BASE, 0.17, { shadow: false });
  add(g, G.sphere(0.014, 8, 6), M(0x2e86de), 0.07, BASE + 0.03, 0.19);
  ground(g, 'paved', LOT - 0.08, 0.08, 0, 0.36);
  fence(g, -0.4, -0.36, 0.4, -0.36, 'picket', BASE);
  fence(g, -0.4, -0.36, -0.4, 0.28, 'picket', BASE);
  fence(g, 0.4, -0.36, 0.4, 0.28, 'picket', BASE);
  bench(g, -0.25, 0.3, Math.PI);
  bench(g, 0.28, 0.3, Math.PI);
  trashBin(g, 0.02, 0.3, BASE);
  tree(g, -0.47, -0.46, 0.85, 'round', r);
  tree(g, 0.47, -0.46, 0.85, pick(['round', 'oak'], r), r);
  tree(g, -0.47, 0.46, 0.75, pick(['blossom', 'birch'], r), r);
  tree(g, 0.47, 0.46, 0.75, 'round', r);
  flowerBed(g, 0, 0.45, 0.4, 0.05, r);
}

function parkGarden(g, r) {
  ground(g, 'paved', LOT - 0.08, 0.09, 0, 0);
  ground(g, 'paved', 0.09, LOT - 0.08, 0, 0);
  add(g, G.circle(0.2, 24), SURF.paved(), 0, BASE + 0.004, 0, { shadow: false });
  // Bandstand
  add(g, G.cyl(0.15, 0.16, 0.03, 8), MAT.stone(), 0, BASE + 0.015, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    add(g, G.cyl(0.006, 0.006, 0.17, 5), MAT.white(), Math.cos(a) * 0.135, BASE + 0.115, Math.sin(a) * 0.135);
    if (i !== 1 && i !== 5) add(g, G.box(0.105, 0.035, 0.004), MAT.white(), Math.cos(a + Math.PI / 8) * 0.125, BASE + 0.05, Math.sin(a + Math.PI / 8) * 0.125, { ry: -(a + Math.PI / 8) + Math.PI / 2 });
  }
  add(g, G.cyl(0.165, 0.165, 0.012, 8), MAT.white(), 0, BASE + 0.2, 0);
  add(g, G.cone(0.18, 0.1, 8), roofOf('park'), 0, BASE + 0.256, 0);
  add(g, G.sphere(0.012, 8, 6), M(0xd4af37, { m: 0.8, r: 0.3 }), 0, BASE + 0.315, 0);
  // Four parterres edged with clipped hedge
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * 0.3, cz = sz * 0.3;
    flowerBed(g, cx, cz, 0.24, 0.24, r);
    for (const s of [-1, 1]) {
      hedge(g, 0.3, 0.03, cx, cz + s * 0.135);
      hedge(g, 0.03, 0.24, cx + s * 0.135, cz);
    }
    add(g, G.cone(0.035, 0.11, 8), M(0x3f7d36, { flat: true, r: 0.9 }), cx, BASE + 0.07, cz);
  }
  for (const [x, z, ry] of [[0.47, 0.1, -Math.PI / 2], [-0.47, -0.1, Math.PI / 2]]) bench(g, x, z, ry);
  streetLamp(g, 0.1, 0.47, Math.PI);
  streetLamp(g, -0.1, -0.47, 0);
  // Statue
  boxAt(g, 0.05, 0.07, 0.05, MAT.stone(), 0, BASE, 0.36);
  add(g, G.cyl(0.012, 0.016, 0.07, 6), M(0x6f8f7c, { r: 0.5, m: 0.6 }), 0, BASE + 0.105, 0.36);
  add(g, G.sphere(0.013, 8, 6), M(0x6f8f7c, { r: 0.5, m: 0.6 }), 0, BASE + 0.15, 0.36);
}

const PARKS = [parkPond, parkFountain, parkWoodland, parkPlayground, parkGarden];
function buildPark(g, r) {
  lot(g, 'grass', 'park');
  PARKS[Math.floor(r() * PARKS.length)](g, r);
}

function buildGovernment(g, r) {
  lot(g, 'grass', 'government');
  const stone = M(0xe6dfcc, { r: 0.75 }), stone2 = M(0xcfc6b0, { r: 0.8 });
  const bronze = M(0x6f8f7c, { r: 0.5, m: 0.6 }), gold = M(0xd4af37, { r: 0.35, m: 0.7 });
  const z = -0.14;
  // Stepped podium
  boxAt(g, 0.98, 0.03, 0.62, stone2, 0, BASE, z);
  boxAt(g, 0.94, 0.03, 0.58, stone, 0, BASE + 0.03, z);
  const y0 = BASE + 0.06, h = 0.38;
  // Central block flanked by lower wings
  facadeBlock(g, 0.56, h, 0.44, 0, y0, z - 0.03, { style: 'stone', wall: 0xe6dfcc, bay: 0.14, floor: h / 2 });
  for (const sx of [-1, 1]) {
    facadeBlock(g, 0.18, 0.3, 0.36, sx * 0.37, y0, z - 0.03, { style: 'stone', wall: 0xe6dfcc, bay: 0.09, floor: 0.15 });
    band(g, 0.18, 0.36, y0 + 0.3, stone2, sx * 0.37, z - 0.03, 0.012, 0.022);
    parapet(g, 0.18, 0.36, y0 + 0.322, stone, 0.012, 0.025, sx * 0.37, z - 0.03);
  }
  // Portico: columns on bases, entablature and pediment
  const zc = z + 0.24;
  for (let i = 0; i < 6; i++) {
    const x = -0.24 + i * 0.096;
    add(g, G.cyl(0.02, 0.024, h - 0.03, 12), stone, x, y0 + h / 2, zc);
    boxAt(g, 0.055, 0.015, 0.055, stone2, x, y0, zc);
    boxAt(g, 0.05, 0.014, 0.05, stone2, x, y0 + h - 0.016, zc);
  }
  boxAt(g, 0.58, 0.05, 0.14, stone, 0, y0 + h, zc - 0.04);
  boxAt(g, 0.6, 0.012, 0.16, stone2, 0, y0 + h + 0.05, zc - 0.04);
  add(g, prismGeo(0.6, 0.12, 0.15), stone2, 0, y0 + h + 0.062, zc - 0.04);
  add(g, G.cyl(0.03, 0.03, 0.006, 12), gold, 0, y0 + h + 0.1, zc + 0.037, { rx: Math.PI / 2 });
  boxAt(g, 0.1, 0.2, 0.008, M(0x5a3a22, { r: 0.6 }), 0, y0, z + 0.192);
  // Wide front steps between statue plinths
  for (let i = 0; i < 4; i++) boxAt(g, 0.5, 0.015 * (4 - i), 0.03, stone2, 0, BASE, z + 0.305 + i * 0.03);
  for (const sx of [-1, 1]) {
    boxAt(g, 0.07, 0.09, 0.1, stone, sx * 0.3, BASE, z + 0.35);
    add(g, G.cyl(0.013, 0.018, 0.07, 6), bronze, sx * 0.3, BASE + 0.125, z + 0.35);
    add(g, G.sphere(0.014, 8, 6), bronze, sx * 0.3, BASE + 0.17, z + 0.35);
  }
  // Balustrade, drum, ribbed dome and lantern
  const top = y0 + h;
  boxAt(g, 0.58, 0.025, 0.46, stone2, 0, top, z - 0.03);
  parapet(g, 0.56, 0.32, top + 0.025, stone, 0.012, 0.028, 0, z - 0.1);
  const zd = z - 0.08;
  add(g, G.cyl(0.17, 0.18, 0.03, 24), stone2, 0, top + 0.04, zd);
  add(g, G.cyl(0.155, 0.155, 0.12, 24), stone, 0, top + 0.115, zd);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(g, G.cyl(0.008, 0.008, 0.12, 6), stone2, Math.cos(a) * 0.162, top + 0.115, zd + Math.sin(a) * 0.162);
  }
  add(g, G.cyl(0.175, 0.175, 0.016, 24), stone2, 0, top + 0.183, zd);
  add(g, G.sphere(0.158, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, top + 0.19, zd, { s: [1, 0.95, 1] });
  for (let i = 0; i < 8; i++) {
    add(g, G.torus(0.159, 0.005, 4, 10, Math.PI / 2), M(0xb8962e, { r: 0.4, m: 0.7 }), 0, top + 0.19, zd, { ry: (i / 8) * Math.PI * 2, s: [1, 0.95, 1] });
  }
  add(g, G.cyl(0.022, 0.03, 0.07, 10), stone, 0, top + 0.37, zd);
  add(g, G.cone(0.03, 0.04, 10), gold, 0, top + 0.425, zd);
  add(g, G.sphere(0.012, 8, 6), gold, 0, top + 0.45, zd);
  // Forecourt
  ground(g, 'paved', 0.5, L2 - (z + 0.42), 0, (z + 0.42 + L2) / 2);
  flag(g, -0.42, 0.42, 0x2471a3, 0.5);
  flag(g, 0.42, 0.42, 0xc0392b, 0.5);
  for (const sx of [-1, 1]) {
    flowerBed(g, sx * 0.4, 0.3, 0.16, 0.06, r);
    hedge(g, 0.045, 0.2, sx * 0.29, 0.44);
    streetLamp(g, sx * 0.5, 0.2, -sx * Math.PI / 2);
  }
  tree(g, -0.48, -0.47, 0.6, 'tall', r);
  tree(g, 0.48, -0.47, 0.6, 'tall', r);
}

function buildPolice(g, r) {
  lot(g, 'paved', 'police');
  const trim = trimOf('police'), navy = 0x2c3e50;
  const x0 = -0.15, z = -0.2, w = 0.6, d = 0.44, fh = 0.24, zf = z + d / 2, yT = BASE + fh * 2;
  facadeBlock(g, w, fh * 2, d, x0, BASE, z, { style: 'office', wall: navy, bay: 0.2, floor: fh, roofMat: roofOf('police') });
  band(g, w, d, BASE + fh - 0.012, MAT.white(), x0, z, 0.008, 0.024);
  band(g, w, d, yT, trim, x0, z, 0.018, 0.035);
  parapet(g, w + 0.02, d + 0.02, yT + 0.035, MAT.white(), 0.015, 0.02, x0, z);
  rooftop(g, w - 0.26, d - 0.1, yT + 0.035, r, x0 + 0.1, z);
  // Radio mast with dishes
  const mx = x0 - 0.2, mz = z - 0.1;
  add(g, G.cyl(0.006, 0.012, 0.5, 6), MAT.metal(), mx, yT + 0.285, mz);
  for (const y of [0.2, 0.32, 0.42]) boxAt(g, 0.07, 0.004, 0.004, MAT.metal(), mx, yT + y, mz);
  satelliteDish(g, mx + 0.015, yT + 0.24, mz, 0.5, 0.7);
  add(g, G.sphere(0.012, 8, 6), M(0xff3b30, { e: 0xff0000, ei: 2 }), mx, yT + 0.54, mz, { shadow: false });
  // Vehicle bay wing with a rooftop helipad
  const xg = 0.34, wg = 0.36, dg = 0.4, hg = 0.26, zg = z - 0.02;
  facadeBlock(g, wg, hg, dg, xg, BASE, zg, { style: 'concrete', wall: 0xaab4bd, bay: 0.18, floor: hg });
  band(g, wg, dg, BASE + hg, trim, xg, zg, 0.012, 0.025);
  for (const dx of [-0.085, 0.085]) texturedPanel(g, 0.14, 0.17, shutterTexture(0x8fa3b5), xg + dx, BASE + 0.085, zg + dg / 2 + 0.004);
  add(g, G.circle(0.15, 24), M(0xffffff, { map: helipadTexture(), r: 0.9 }), xg, BASE + hg + 0.03, zg, { shadow: false });
  // Entrance: steps, canopy, sign and blue lamps
  steps(g, 0.3, 2, x0, BASE, zf + 0.07, MAT.concrete(), 0.01, 0.035);
  boxAt(g, 0.15, 0.18, 0.01, MAT.lit(), x0, BASE + 0.02, zf + 0.004);
  boxAt(g, 0.006, 0.18, 0.014, MAT.darkMetal(), x0, BASE + 0.02, zf + 0.005);
  boxAt(g, 0.32, 0.02, 0.12, MAT.white(), x0, BASE + 0.21, zf + 0.06);
  boxAt(g, 0.36, 0.085, 0.01, M(0x1f4e8c), x0, yT - 0.125, zf + 0.004);
  texturedPanel(g, 0.34, 0.075, signTexture('POLICE', 0x1f4e8c), x0, yT - 0.0825, zf + 0.01, 0, 0.7);
  for (const sx of [-1, 1]) {
    boxAt(g, 0.008, 0.16, 0.008, MAT.darkMetal(), x0 + sx * 0.14, BASE, zf + 0.11);
    add(g, G.sphere(0.018, 8, 6), M(0x5dade2, { e: 0x3498db, ei: 1.4 }), x0 + sx * 0.14, BASE + 0.17, zf + 0.11, { shadow: false });
  }
  // Car park with patrol cars behind a barrier
  for (let i = 0; i < 4; i++) boxAt(g, 0.01, 0.003, 0.2, MAT.white(), -0.02 + i * 0.17, BASE, 0.4, { shadow: false });
  for (const x of [0.065, 0.235]) {
    const car = vehicle('police', 0x1c2833, r);
    car.position.set(x, BASE, 0.4); car.scale.setScalar(0.78);
    g.add(car);
    const [red, blue] = car.userData.siren;
    blinkPair(g, red, blue, 3 + r() * 2);
  }
  boxAt(g, 0.03, 0.07, 0.03, M(0xf2f0ea), 0.5, BASE, 0.3);
  for (let i = 0; i < 4; i++) boxAt(g, 0.012, 0.012, 0.045, M(i % 2 ? 0xf2f0ea : 0xd63a2f), 0.5, BASE + 0.06, 0.335 + i * 0.045);
  flag(g, -0.46, 0.4, 0x2471a3, 0.5);
  planter(g, -0.36, 0.14, BASE, 0x4f8f3a);
  planter(g, -0.3, 0.44, BASE, 0x4f8f3a);
  bench(g, -0.38, 0.28, Math.PI / 2);
  fence(g, -L2 + 0.05, -L2 + 0.045, L2 - 0.05, -L2 + 0.045, 'chain', BASE);
}

function buildFire(g, r) {
  lot(g, 'asphalt', 'fire');
  const z = -0.18, w = 0.7, d = 0.46, fh = 0.26, x0 = -0.08, zf = z + d / 2, yT = BASE + fh * 2;
  const brick = pick([0xa93226, 0x922b21, 0xb03a2e], r);
  facadeBlock(g, w, fh * 2, d, x0, BASE, z, { style: 'brick', wall: brick, bay: 0.175, floor: fh, roofMat: MAT.roof() });
  band(g, w, d, BASE + fh - 0.01, MAT.white(), x0, z, 0.01, 0.025);
  band(g, w, d, yT, roofOf('fire'), x0, z, 0.02, 0.035);
  parapet(g, w + 0.02, d + 0.02, yT + 0.035, MAT.white(), 0.015, 0.022, x0, z);
  rooftop(g, w - 0.14, d - 0.12, yT + 0.035, r, x0, z);
  // Two engine bays with glazed doors in white surrounds
  for (const dx of [-0.17, 0.11]) {
    const bx = x0 + dx;
    boxAt(g, 0.27, 0.245, 0.008, MAT.white(), bx, BASE, zf + 0.002);
    texturedPanel(g, 0.23, 0.22, shutterTexture(0xc0392b), bx, BASE + 0.11, zf + 0.008);
    boxAt(g, 0.21, 0.035, 0.004, MAT.glass(), bx, BASE + 0.14, zf + 0.009);
    for (let i = 1; i < 4; i++) boxAt(g, 0.006, 0.035, 0.006, MAT.white(), bx - 0.105 + i * 0.0525, BASE + 0.14, zf + 0.009);
  }
  boxAt(g, 0.46, 0.08, 0.01, M(0x7b241c), x0 - 0.03, BASE + fh + 0.065, zf + 0.004);
  texturedPanel(g, 0.44, 0.07, signTexture('FIRE DEPT', 0x7b241c, 0xffd54f), x0 - 0.03, BASE + fh + 0.105, zf + 0.01, 0, 0.5);
  // Brass bell and wall-mounted hose reel
  add(g, G.sphere(0.018, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd4af37, { m: 0.8, r: 0.3 }), x0 + 0.3, BASE + 0.2, zf + 0.025);
  boxAt(g, 0.006, 0.006, 0.03, MAT.darkMetal(), x0 + 0.3, BASE + 0.215, zf);
  add(g, G.cyl(0.03, 0.03, 0.016, 12), M(0xc0392b), x0 - 0.325, BASE + 0.12, zf + 0.01, { rx: Math.PI / 2 });
  // Hose-drying tower
  const tx = 0.42, tz = -0.32, th = 0.95;
  facadeBlock(g, 0.17, th, 0.17, tx, BASE, tz, { style: 'brick', wall: brick, bay: 0.17, floor: 0.19, top: false });
  band(g, 0.17, 0.17, BASE + th - 0.17, MAT.white(), tx, tz, 0.01, 0.02);
  band(g, 0.17, 0.17, BASE + th, MAT.white(), tx, tz, 0.018, 0.022);
  add(g, taperGeo(0.22, 0.14, 0.22, 0.012, 0.012), roofOf('fire'), tx, BASE + th + 0.022, tz);
  const sA = add(g, G.sphere(0.022, 8, 6), M(0xff3b30, { e: 0xff1a0a, ei: 2 }), tx - 0.04, BASE + th - 0.05, tz + 0.092, { shadow: false });
  const sB = add(g, G.sphere(0.022, 8, 6), M(0xff3b30, { e: 0xff1a0a, ei: 2 }), tx + 0.04, BASE + th - 0.05, tz + 0.092, { shadow: false });
  sA.userData.noBake = sB.userData.noBake = true;
  blinkPair(g, sA, sB, 2.5);
  // Apron markings, engine, chief's car, cones
  const yel = M(0xf1c40f, { r: 0.6 });
  for (const dx of [-0.17, 0.11]) for (const s of [-1, 1]) {
    boxAt(g, 0.012, 0.003, 0.42, yel, x0 + dx + s * 0.125, BASE, 0.27, { shadow: false });
  }
  const engine = vehicle('firetruck', 0xd32f2f, r);
  engine.position.set(x0 - 0.17, BASE, 0.3); engine.scale.setScalar(0.82);
  g.add(engine);
  const chief = vehicle('pickup', 0xd32f2f, r);
  chief.position.set(0.42, BASE, 0.1); chief.scale.setScalar(0.75);
  g.add(chief);
  for (const [cx, cz] of [[0.16, 0.44], [0.22, 0.46], [0.28, 0.44]]) {
    boxAt(g, 0.022, 0.004, 0.022, M(0xe67e22), cx, BASE, cz);
    add(g, G.cone(0.009, 0.03, 6), M(0xe67e22, { r: 0.6 }), cx, BASE + 0.019, cz);
  }
  hydrant(g, 0.47, 0.44, BASE);
  flag(g, 0.3, 0.3, 0xc0392b, 0.5);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CATALOGUE
// ═══════════════════════════════════════════════════════════════════════════
// Homes are rebuilt as they fill up: houses → walk-ups → apartment blocks.
export const RES_STAGES = [
  [[buildCottage, 3], [buildTownhouse, 2], [buildRanch, 2], [buildVilla, 1]],
  [[buildWalkup, 1]],
  [[buildTowerBlock, 1]],
];
// Styles the player can pick (ids match BUILD_STYLES in constants.js)
export const STYLES = {
  commercial: { shops: buildShops, midrise: buildMidrise, office: buildOffice },
  industrial: { factory: buildFactory, warehouse: buildWarehouse, refinery: buildRefinery },
};
export const BUILDERS = {
  residential: RES_STAGES[0],
  commercial:  [[buildShops, 3], [buildOffice, 2], [buildMidrise, 2]],
  industrial:  [[buildFactory, 2], [buildWarehouse, 2], [buildRefinery, 1]],
  power:       [[buildPower, 1]],
  school:      [[buildSchool, 1]],
  park:        [[buildPark, 1]],
  government:  [[buildGovernment, 1]],
  police:      [[buildPolice, 1]],
  fire:        [[buildFire, 1]],
};
