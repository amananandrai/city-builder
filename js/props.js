/**
 * props.js — shared modelling toolkit: cached materials/geometries,
 * placement helpers, reusable props (trees, cars, lamps…) and a bake step
 * that merges a building's static parts into one mesh per material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facadeTexture, gravelRoofTexture } from './textures.js';

// ── Materials ──────────────────────────────────────────────────────────────
const matCache = {};
/**
 * Cached MeshStandardMaterial.
 * opts: r (roughness), m (metalness), e (emissive hex), ei (emissive
 * intensity), map, flat (flatShading), opacity
 */
export function M(color, opts = {}) {
  const key = `${color}|${opts.r ?? ''}|${opts.m ?? ''}|${opts.e ?? ''}|${opts.ei ?? ''}|${opts.map?.uuid ?? ''}|${opts.flat ? 1 : 0}|${opts.opacity ?? ''}`;
  return matCache[key] ??= new THREE.MeshStandardMaterial({
    color,
    roughness: opts.r ?? 0.85,
    metalness: opts.m ?? 0,
    emissive: opts.e ?? 0x000000,
    emissiveIntensity: opts.ei ?? 1,
    map: opts.map ?? null,
    flatShading: !!opts.flat,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.opacity === undefined,
  });
}

// Common palette materials
export const MAT = {
  glass:    () => M(0x6f9ec4, { r: 0.1, m: 0.6 }),
  darkGlass:() => M(0x24384f, { r: 0.1, m: 0.7 }),
  metal:    () => M(0xb7bcc2, { r: 0.35, m: 0.8 }),
  darkMetal:() => M(0x4b5057, { r: 0.4, m: 0.7 }),
  concrete: () => M(0xb9b6ae, { r: 0.95 }),
  white:    () => M(0xf2f0ea, { r: 0.7 }),
  wood:     () => M(0x8a5a35, { r: 0.9 }),
  trunk:    () => M(0x6b4528, { r: 0.95 }),
  rubber:   () => M(0x1e1e1e, { r: 0.9 }),
  roof:     () => M(0xffffff, { r: 1, map: gravelRoofTexture() }),
  water:    () => M(0x3b8fc4, { r: 0.05, m: 0.3 }),
};

// ── Geometries ─────────────────────────────────────────────────────────────
const geoCache = {};
const gkey = (n, a) => n + a.map(v => +v.toFixed(4)).join(',');
export const G = {
  box:    (w, h, d)            => geoCache[gkey('b', [w, h, d])] ??= new THREE.BoxGeometry(w, h, d),
  cyl:    (rt, rb, h, s = 16)  => geoCache[gkey('c', [rt, rb, h, s])] ??= new THREE.CylinderGeometry(rt, rb, h, s),
  sphere: (r, ws = 12, hs = 8) => geoCache[gkey('s', [r, ws, hs])] ??= new THREE.SphereGeometry(r, ws, hs),
  cone:   (r, h, s = 12)       => geoCache[gkey('k', [r, h, s])] ??= new THREE.ConeGeometry(r, h, s),
  ico:    (r, d = 1)           => geoCache[gkey('i', [r, d])] ??= new THREE.IcosahedronGeometry(r, d),
  circle: (r, s = 24)          => geoCache[gkey('o', [r, s])] ??= new THREE.CircleGeometry(r, s).rotateX(-Math.PI / 2),
  plane:  (w, h)               => geoCache[gkey('p', [w, h])] ??= new THREE.PlaneGeometry(w, h),
  torus:  (r, t, rs = 8, ts = 24) => geoCache[gkey('t', [r, t, rs, ts])] ??= new THREE.TorusGeometry(r, t, rs, ts),
};

/** Triangular prism (gable roof): ridge runs along z. Base at y=0. */
export function prismGeo(w, h, d) {
  return geoCache[gkey('prism', [w, h, d])] ??= (() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  })();
}

/** Hyperboloid cooling-tower shell. */
export function coolingTowerGeo(rBase, rWaist, rTop, h) {
  return geoCache[gkey('tower', [rBase, rWaist, rTop, h])] ??= (() => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = t < 0.7
        ? rBase + (rWaist - rBase) * Math.sin((t / 0.7) * Math.PI / 2)
        : rWaist + (rTop - rWaist) * ((t - 0.7) / 0.3) ** 2;
      pts.push(new THREE.Vector2(r, t * h));
    }
    return new THREE.LatheGeometry(pts, 24);
  })();
}

// ── Placement helpers ──────────────────────────────────────────────────────
/** Add a mesh at (x, y, z) with optional rotation/scale. */
export function add(parent, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.s) Array.isArray(o.s) ? m.scale.set(...o.s) : m.scale.setScalar(o.s);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Box whose bottom sits at y0. */
export function boxAt(parent, w, h, d, mat, x, y0, z, o) {
  return add(parent, G.box(w, h, d), mat, x, y0 + h / 2, z, o);
}

/**
 * Building block with a tiled window facade on the sides and a gravel/flat
 * roof on top. Window bays are `bay` wide and floors are `floor` tall, so the
 * texture lines up regardless of the block's size.
 */
export function facadeBlock(parent, w, h, d, x, y0, z, { style, wall, bay = 0.22, floor = 0.26, roofMat } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f];
    const su = f === 2 || f === 3 ? du : du / (bay * 4);
    const sv = f === 2 || f === 3 ? dv : dv / (floor * 4);
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  const side = M(0xffffff, { r: style === 'glass' || style === 'office' ? 0.35 : 0.85, m: style === 'glass' ? 0.3 : 0, map: facadeTexture(style, wall) });
  const top = roofMat ?? MAT.roof();
  const mesh = new THREE.Mesh(geo, [side, side, top, top, side, side]);
  mesh.position.set(x, y0 + h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.noBake = true;
  parent.add(mesh);
  return mesh;
}

/** Flat textured plane facing +z, rotated by ry (signs, doors). */
const panelMats = {};
export function texturedPanel(parent, w, h, tex, x, y, z, ry = 0, glow = 0) {
  const mat = panelMats[tex.uuid + glow] ??= new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.6,
    emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? tex : null, emissiveIntensity: glow,
  });
  return add(parent, G.plane(w, h), mat, x, y, z, { ry, shadow: false });
}

// ── Seeded RNG (stable variety for tiles that get rebuilt) ─────────────────
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

// ── Props ──────────────────────────────────────────────────────────────────
const LEAF = [0x4f8f3a, 0x5fa043, 0x3f7d36, 0x6aa84f, 0x7fb24a];
const PINE = [0x2f6b3b, 0x3a7a45, 0x285e35];
const AUTUMN = [0xd98c2b, 0xc4572a, 0xe0b23a];

/** A stylised tree. kind: 'round' | 'pine' | 'tall' | 'autumn' */
export function tree(parent, x, z, s = 1, kind = 'round', r = Math.random) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = r() * Math.PI * 2;
  if (kind === 'pine') {
    add(g, G.cyl(0.025, 0.035, 0.14, 6), MAT.trunk(), 0, 0.07, 0);
    const mat = M(pick(PINE, r), { flat: true, r: 0.9 });
    add(g, G.cone(0.17, 0.26, 7), mat, 0, 0.24, 0);
    add(g, G.cone(0.13, 0.22, 7), mat, 0, 0.36, 0);
    add(g, G.cone(0.085, 0.18, 7), mat, 0, 0.47, 0);
  } else {
    const tall = kind === 'tall';
    const trunkH = tall ? 0.26 : 0.16;
    add(g, G.cyl(0.022, 0.032, trunkH, 6), MAT.trunk(), 0, trunkH / 2, 0);
    const mat = M(pick(kind === 'autumn' ? AUTUMN : LEAF, r), { flat: true, r: 0.9 });
    const base = trunkH + 0.08;
    add(g, G.ico(tall ? 0.13 : 0.15, 1), mat, 0, base + 0.04, 0, { s: tall ? [1, 1.5, 1] : 1 });
    add(g, G.ico(0.1, 1), mat, 0.07, base, 0.04);
    add(g, G.ico(0.09, 1), mat, -0.06, base + 0.02, -0.05);
  }
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

export function bush(parent, x, z, s = 1, color = 0x4f8f3a) {
  return add(parent, G.ico(0.07, 1), M(color, { flat: true, r: 0.9 }), x, 0.05 * s, z, { s: [s, s * 0.75, s] });
}

export function hedge(parent, w, d, x, z) {
  return boxAt(parent, w, 0.07, d, M(0x3f7d36, { r: 0.95 }), x, 0.02, z);
}

export function streetLamp(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  add(g, G.cyl(0.012, 0.016, 0.42, 6), MAT.darkMetal(), 0, 0.21, 0);
  add(g, G.box(0.012, 0.012, 0.1), MAT.darkMetal(), 0, 0.42, 0.045);
  add(g, G.box(0.04, 0.02, 0.06), M(0xfff3c4, { e: 0xffe9a0, ei: 0.8 }), 0, 0.41, 0.09, { shadow: false });
  parent.add(g);
  return g;
}

export function bench(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  boxAt(g, 0.14, 0.012, 0.05, MAT.wood(), 0, 0.04, 0);
  boxAt(g, 0.14, 0.04, 0.01, MAT.wood(), 0, 0.055, -0.024);
  for (const sx of [-0.06, 0.06]) boxAt(g, 0.01, 0.04, 0.04, MAT.darkMetal(), sx, 0, 0);
  parent.add(g);
  return g;
}

export function flagpole(parent, x, z, flagColor = 0xc0392b, h = 0.6) {
  add(parent, G.cyl(0.008, 0.01, h, 6), MAT.metal(), x, h / 2, z);
  add(parent, G.sphere(0.014, 8, 6), M(0xd4af37, { m: 0.8, r: 0.3 }), x, h + 0.01, z);
  const flag = add(parent, G.box(0.14, 0.085, 0.004), M(flagColor, { r: 0.8 }), x + 0.075, h - 0.05, z);
  flag.userData.noBake = true;
  flag.userData.flag = true;
  return flag;
}

const CAR_COLORS = [0xd63031, 0x0984e3, 0xfdcb6e, 0xf5f6fa, 0x2d3436, 0x00b894, 0xe17055, 0x6c5ce7, 0xb2bec3];

/**
 * Small vehicle facing +z. kind: 'sedan' | 'hatch' | 'van' | 'truck' | 'bus'
 * | 'police' | 'firetruck'
 */
export function vehicle(kind = 'sedan', color = null, r = Math.random) {
  const g = new THREE.Group();
  const c = color ?? pick(CAR_COLORS, r);
  const paint = M(c, { r: 0.35, m: 0.4 });
  const glassM = MAT.darkGlass();
  const wheelR = 0.032;

  let L = 0.36, W = 0.18, bodyH = 0.075, cabH = 0.065, cabL = 0.19, cabZ = -0.01;
  if (kind === 'hatch') { L = 0.3; cabL = 0.17; cabZ = -0.03; }
  if (kind === 'van')   { L = 0.38; bodyH = 0.09; cabH = 0.1; cabL = 0.3; cabZ = -0.03; }
  if (kind === 'bus')   { L = 0.62; W = 0.2; bodyH = 0.1; cabH = 0.1; cabL = 0.6; cabZ = 0; }
  if (kind === 'truck' || kind === 'firetruck') { L = 0.52; W = 0.2; bodyH = 0.09; }

  boxAt(g, W, bodyH, L, paint, 0, wheelR * 0.8, 0);
  if (kind === 'truck') {
    boxAt(g, W, 0.09, 0.14, paint, 0, wheelR * 0.8 + bodyH, L / 2 - 0.08);
    boxAt(g, W * 0.92, 0.04, 0.012, glassM, 0, wheelR * 0.8 + bodyH + 0.035, L / 2 - 0.006);
    boxAt(g, W * 1.02, 0.14, 0.34, M(pick([0xecf0f1, 0xd35400, 0x2980b9], r), { r: 0.6 }), 0, wheelR * 0.8 + bodyH - 0.01, -0.08);
  } else if (kind === 'firetruck') {
    boxAt(g, W, 0.09, 0.15, paint, 0, wheelR * 0.8 + bodyH, L / 2 - 0.085);
    boxAt(g, W * 0.92, 0.04, 0.012, glassM, 0, wheelR * 0.8 + bodyH + 0.035, L / 2 - 0.009);
    boxAt(g, W * 0.95, 0.05, 0.32, M(0xb71c1c, { r: 0.5 }), 0, wheelR * 0.8 + bodyH, -0.09);
    // Ladder
    for (const sx of [-0.04, 0.04]) boxAt(g, 0.008, 0.008, 0.42, MAT.metal(), sx, wheelR * 0.8 + bodyH + 0.055, -0.04);
    for (let i = 0; i < 8; i++) boxAt(g, 0.08, 0.006, 0.006, MAT.metal(), 0, wheelR * 0.8 + bodyH + 0.055, -0.23 + i * 0.05);
    boxAt(g, 0.12, 0.018, 0.03, M(0xff3b30, { e: 0xff2a1a, ei: 1.2 }), 0, wheelR * 0.8 + bodyH + 0.09, L / 2 - 0.05, { shadow: false });
  } else {
    const y = wheelR * 0.8 + bodyH;
    boxAt(g, W * 0.86, cabH, cabL, paint, 0, y, cabZ);
    // Windows: a slightly larger dark band wrapped around the cabin
    boxAt(g, W * 0.88, cabH * 0.6, cabL * 0.9, glassM, 0, y + cabH * 0.25, cabZ);
    if (kind === 'bus') {
      boxAt(g, W * 1.005, 0.02, L * 0.96, M(0xffffff, { r: 0.5 }), 0, y - 0.02, 0);
    }
    if (kind === 'police') {
      boxAt(g, W * 1.002, 0.03, L * 0.5, M(0xffffff, { r: 0.4 }), 0, wheelR * 0.8 + 0.03, 0);
      const red  = add(g, G.box(0.04, 0.02, 0.03), M(0xff2d2d, { e: 0xff0000, ei: 1.5 }), -0.025, y + cabH + 0.01, cabZ, { shadow: false });
      const blue = add(g, G.box(0.04, 0.02, 0.03), M(0x2d6bff, { e: 0x0050ff, ei: 1.5 }),  0.025, y + cabH + 0.01, cabZ, { shadow: false });
      red.userData.noBake = blue.userData.noBake = true;
      g.userData.siren = [red, blue];
    }
  }
  // Wheels
  const wheelGeo = G.cyl(wheelR, wheelR, 0.03, 10);
  const axles = kind === 'bus' ? [L / 2 - 0.1, -L / 2 + 0.1] : [L / 2 - 0.08, -L / 2 + 0.08];
  for (const az of axles) for (const sx of [-W / 2, W / 2]) {
    add(g, wheelGeo, MAT.rubber(), sx, wheelR, az, { rz: Math.PI / 2 });
  }
  // Lights
  const head = M(0xfffbe6, { e: 0xfff2c0, ei: 0.8 });
  const tail = M(0xff3b30, { e: 0xff1a0a, ei: 0.6 });
  for (const sx of [-W * 0.33, W * 0.33]) {
    add(g, G.box(0.035, 0.02, 0.006), head, sx, wheelR * 0.8 + bodyH * 0.6, L / 2 + 0.002, { shadow: false });
    add(g, G.box(0.035, 0.018, 0.006), tail, sx, wheelR * 0.8 + bodyH * 0.6, -L / 2 - 0.002, { shadow: false });
  }
  return g;
}

export function randomTrafficKind(r = Math.random) {
  const v = r();
  if (v < 0.45) return 'sedan';
  if (v < 0.7) return 'hatch';
  if (v < 0.85) return 'van';
  if (v < 0.95) return 'truck';
  return 'bus';
}

/** Rooftop clutter: AC units, vents, water tank. */
export function rooftop(parent, w, d, y, r = Math.random) {
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * (w - 0.18), z = (r() - 0.5) * (d - 0.18);
    boxAt(parent, 0.1, 0.06, 0.08, MAT.metal(), x, y, z);
    add(parent, G.cyl(0.025, 0.025, 0.012, 10), MAT.darkMetal(), x, y + 0.066, z);
  }
  if (r() < 0.35) {
    const x = (r() - 0.5) * (w - 0.2), z = (r() - 0.5) * (d - 0.2);
    for (const [lx, lz] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03]])
      boxAt(parent, 0.008, 0.06, 0.008, MAT.darkMetal(), x + lx, y, z + lz);
    add(parent, G.cyl(0.05, 0.05, 0.09, 12), MAT.wood(), x, y + 0.105, z);
    add(parent, G.cone(0.055, 0.04, 12), MAT.darkMetal(), x, y + 0.17, z);
  }
}

// ── Bake ───────────────────────────────────────────────────────────────────
/**
 * Merge every static single-material mesh in `group` into one mesh per
 * material. Cuts draw calls from ~50 per building to ~10. Meshes flagged
 * userData.noBake (animated parts, multi-material blocks) are kept as is.
 */
export function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let skip = false;
    for (let p = o; p && p !== group; p = p.parent) if (p.userData.noBake) skip = true;
    if (skip) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    geo.clearGroups();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + (o.castShadow ? 's' : 'n');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, shadow: o.castShadow, geos: [] });
    buckets.get(key).geos.push(geo);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  // Drop now-empty helper groups
  const empties = [];
  group.traverse(o => { if (o !== group && o.isGroup && o.children.length === 0) empties.push(o); });
  empties.forEach(o => o.parent?.remove(o));

  for (const { mat, shadow, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
