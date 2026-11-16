/**
 * buildkit.js — parts shared by every building model: the lot plate, themed
 * roof/trim materials, pitched roofs, balconies, smoke and blinking lights.
 *
 * Lot space: x/z within ±L2, the front of the lot is +z (rotated to face a
 * road), and y = BASE is the top of the lot plate.
 */
import * as THREE from 'three';
import { CELL, ZONE_DEF } from './constants.js';
import {
  M, MAT, G, add, boxAt, slab, prismGeo, taperGeo, seasonalGrass, snowy, flagpole,
} from './props.js';
import { grassTexture, asphaltTexture, paverTexture, shingleTexture, roofPanelTexture } from './textures.js';

export const HALF = CELL / 2;    // 0.6
export const LOT  = CELL * 0.92; // buildable lot width
export const L2   = LOT / 2;
export const BASE = 0.03;        // lot plate height

// ── Ground surfaces ────────────────────────────────────────────────────────
export const SURF = {
  grass:   () => seasonalGrass(M(0xffffff, { map: grassTexture(), r: 1 })),
  paved:   () => M(0xffffff, { map: paverTexture(), r: 0.9 }),
  asphalt: () => M(0xffffff, { map: asphaltTexture(), r: 0.95 }),
};
const TEX_SCALE = { grass: 0.6, paved: 4, asphalt: 1 / CELL }; // repeats per unit

/** Flat patch of ground (path, plaza, driveway) lying on the lot. */
export function ground(g, surface, w, d, x, z, y = BASE, h = 0.005, o) {
  return slab(g, w, h, d, SURF[surface](), x, y, z, TEX_SCALE[surface], { shadow: false, ...o });
}

// ── Visual theme ───────────────────────────────────────────────────────────
// Every building wears its type's colour (the same one as its toolbar button)
// on the roof and trim, so a district can be read at a glance from above:
// blue homes, amber commerce, purple industry, and one colour per service.
export const themeHex = type => ZONE_DEF[type]?.color ?? 0x888888;
export const roofOf = type => snowy(M(themeHex(type), { r: 0.72, map: roofPanelTexture() }), 0.45);
export const trimOf = type => M(themeHex(type), { r: 0.6 });

export function lot(g, surface, zoneType) {
  slab(g, LOT, BASE, LOT, SURF[surface](), 0, 0, 0, TEX_SCALE[surface], { shadow: false });
  // Thin zone-coloured kerb so zones stay readable at a glance
  const kerb = trimOf(zoneType);
  const t = 0.04;
  boxAt(g, LOT, BASE + 0.008, t, kerb,  0, 0,  L2 - t / 2, { shadow: false });
  boxAt(g, LOT, BASE + 0.008, t, kerb,  0, 0, -L2 + t / 2, { shadow: false });
  boxAt(g, t, BASE + 0.008, LOT, kerb,  L2 - t / 2, 0, 0, { shadow: false });
  boxAt(g, t, BASE + 0.008, LOT, kerb, -L2 + t / 2, 0, 0, { shadow: false });
}

// ── Animation hooks ────────────────────────────────────────────────────────
export const anim = (g, fn) => (g.userData.anim ??= []).push(fn);

export function smoke(g, x, y, z, scale = 1, count = 5) {
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

export function blinkPair(g, a, b, rate = 4) {
  anim(g, t => {
    const on = Math.floor(t * rate) % 2 === 0;
    a.visible = on; b.visible = !on;
  });
}

/** Red aircraft-warning beacon on a thin mast. */
export function beacon(g, x, y, z, h = 0.3) {
  add(g, G.cyl(0.004, 0.009, h, 6), MAT.metal(), x, y + h / 2, z);
  add(g, G.sphere(0.012, 8, 6), M(0xff3b30, { e: 0xff0000, ei: 2 }), x, y + h + 0.005, z, { shadow: false });
}

// ── Architectural parts ────────────────────────────────────────────────────
export function parapet(g, w, d, y, mat, t = 0.03, h = 0.04, x = 0, z = 0) {
  boxAt(g, w, h, t, mat, x, y, z + d / 2 - t / 2);
  boxAt(g, w, h, t, mat, x, y, z - d / 2 + t / 2);
  boxAt(g, t, h, d - t * 2, mat, x + w / 2 - t / 2, y, z);
  boxAt(g, t, h, d - t * 2, mat, x - w / 2 + t / 2, y, z);
}

/** Projecting band around a block (cornice, string course, fascia). */
export function band(g, w, d, y, mat, x = 0, z = 0, out = 0.015, h = 0.025) {
  return boxAt(g, w + out * 2, h, d + out * 2, mat, x, y, z);
}

const shingles = hex => snowy(M(0xffffff, { map: shingleTexture(hex), r: 0.9 }), 0.85);

/**
 * Gable roof over a w × d block centred on (x, z) with its eaves at y.
 * The ridge runs along x; ry = π/2 turns it to run along z.
 */
export function gableRoof(g, w, d, rh, y, x, z, wallHex, roofHex, ry = 0) {
  const s = new THREE.Group();
  s.position.set(x, y, z); s.rotation.y = ry;
  add(s, prismGeo(d, rh, w), M(wallHex, { r: 0.85 }), 0, 0, 0, { ry: Math.PI / 2 });
  const roof = shingles(roofHex);
  const a = Math.atan2(rh, d / 2);
  const len = Math.hypot(d / 2, rh) + 0.07;
  for (const sg of [-1, 1]) {
    add(s, G.box(w + 0.09, 0.024, len), roof, 0, rh / 2 + 0.004, sg * (d / 4 + 0.016), { rx: sg * a });
    // Fascia board along the eave
    boxAt(s, w + 0.09, 0.014, 0.012, MAT.white(), 0, -0.022, sg * (d / 2 + 0.045));
  }
  boxAt(s, w + 0.1, 0.016, 0.034, M(roofHex, { r: 0.8 }), 0, rh + 0.004, 0); // ridge cap
  // Attic vent on each gable end
  if (rh > 0.12) for (const sg of [-1, 1]) boxAt(s, 0.004, 0.045, 0.04, MAT.darkGlass(), sg * (w / 2 + 0.001), rh * 0.3, 0);
  g.add(s);
  return s;
}

/** Hip roof: a tapered cap with shingles. */
export function hipRoof(g, w, d, rh, y, x, z, roofHex, over = 0.05) {
  const W = w + over * 2, D = d + over * 2;
  const ridge = Math.max(0.03, W - D);
  boxAt(g, W, 0.014, D, MAT.white(), x, y - 0.006, z);
  return add(g, taperGeo(W, rh, D, W > D ? ridge : 0.03, W > D ? 0.03 : Math.max(0.03, D - W)), shingles(roofHex), x, y + 0.008, z);
}

/** Small gabled dormer with a window, facing +z. */
export function dormer(g, x, y, z, wallHex, roofHex) {
  boxAt(g, 0.1, 0.085, 0.1, M(wallHex, { r: 0.85 }), x, y, z);
  boxAt(g, 0.06, 0.055, 0.004, MAT.glass(), x, y + 0.018, z + 0.051);
  boxAt(g, 0.07, 0.006, 0.006, MAT.white(), x, y + 0.012, z + 0.053);
  const roof = M(roofHex, { r: 0.85 });
  for (const sg of [-1, 1]) add(g, G.box(0.075, 0.012, 0.12), roof, x + sg * 0.03, y + 0.105, z, { rz: -sg * 0.6 });
}

/** Balcony slab with a railing, projecting toward +z before rotation. */
export function balcony(g, x, y, z, w, ry = 0, glass = false, depth = 0.07) {
  const b = new THREE.Group();
  b.position.set(x, y, z); b.rotation.y = ry;
  boxAt(b, w, 0.012, depth, MAT.concrete(), 0, 0, depth / 2);
  if (glass) {
    const rail = MAT.railGlass();
    boxAt(b, w, 0.05, 0.004, rail, 0, 0.012, depth - 0.002, { shadow: false });
    for (const sx of [-1, 1]) boxAt(b, 0.004, 0.05, depth, rail, sx * (w / 2 - 0.002), 0.012, depth / 2, { shadow: false });
    boxAt(b, w + 0.004, 0.005, 0.006, MAT.metal(), 0, 0.062, depth - 0.002);
  } else {
    const rail = MAT.darkMetal();
    boxAt(b, w, 0.006, 0.006, rail, 0, 0.058, depth - 0.003);
    for (const sx of [-1, 1]) boxAt(b, 0.006, 0.006, depth, rail, sx * (w / 2 - 0.003), 0.058, depth / 2);
    const n = Math.max(2, Math.round(w / 0.028));
    for (let i = 0; i <= n; i++) boxAt(b, 0.004, 0.048, 0.004, rail, -w / 2 + 0.003 + (i / n) * (w - 0.006), 0.012, depth - 0.003);
  }
  g.add(b);
  return b;
}

/** Flight of steps rising toward -z, bottom tread at z0. */
export function steps(g, w, n, x, y, z0, mat = MAT.concrete(), rise = 0.018, run = 0.03) {
  for (let i = 0; i < n; i++) boxAt(g, w, rise * (i + 1), run, mat, x, y, z0 - i * run);
}

/** Front door with a frame, set against a wall whose face is at zf. */
export function door(g, x, y, zf, color = 0x6b3e26, w = 0.075, h = 0.16, frame = MAT.white()) {
  boxAt(g, w + 0.03, h + 0.015, 0.008, frame, x, y, zf + 0.004);
  boxAt(g, w, h, 0.012, M(color, { r: 0.6 }), x, y, zf + 0.006);
  boxAt(g, w * 0.5, h * 0.22, 0.004, MAT.glass(), x, y + h * 0.66, zf + 0.012);
  add(g, G.sphere(0.006, 6, 4), M(0xd4af37, { m: 0.8, r: 0.3 }), x + w * 0.32, y + h * 0.45, zf + 0.014, { shadow: false });
}

/** Flagpole whose flag flutters. */
export function flag(g, x, z, color, h = 0.55) {
  const f = flagpole(g, x, z, color, h);
  const phase = x * 7 + z * 3;
  anim(g, t => {
    const a = Math.sin(t * 2.6 + phase) * 0.28 + Math.sin(t * 6.1 + phase) * 0.08;
    f.rotation.y = a;
    f.position.x = x + Math.cos(a) * 0.075;
    f.position.z = z - Math.sin(a) * 0.075;
  });
  return f;
}
