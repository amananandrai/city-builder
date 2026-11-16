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

// ── Night glow ─────────────────────────────────────────────────────────────
// Materials whose emissive strength follows the day/night cycle.
const glowMats = [];
let nightK = 0;
export function nightGlow(mat, day, night) {
  if (!mat.userData.nightGlow) {
    mat.userData.nightGlow = true;
    glowMats.push({ mat, day, night });
    mat.emissiveIntensity = day + (night - day) * nightK;
  }
  return mat;
}
/** k: 0 = full day, 1 = deep night. */
export function setNight(k) {
  if (Math.abs(k - nightK) < 0.004) return;
  nightK = k;
  for (const { mat, day, night } of glowMats) mat.emissiveIntensity = day + (night - day) * k;
}

// ── Snow & seasons ─────────────────────────────────────────────────────────
const SNOW = { value: 0 };
/** Make a material blend toward snow-white in winter (shared uniform). */
export function snowy(mat, amount = 1) {
  if (mat.userData.snowy) return mat;
  mat.userData.snowy = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSnow = SNOW;
    sh.fragmentShader = 'uniform float uSnow;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.88, 0.94), uSnow * ${amount.toFixed(2)});`
    );
  };
  mat.customProgramCacheKey = () => 'snow' + amount;
  return mat;
}
const grassMats = [];
/** Grass that yellows in autumn and is snow-covered in winter. */
export function seasonalGrass(mat) {
  if (!mat.userData.seasonal) {
    mat.userData.seasonal = true;
    snowy(mat);
    grassMats.push({ mat, base: mat.color.clone() });
  }
  return mat;
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
  roof:     () => snowy(M(0xffffff, { r: 1, map: gravelRoofTexture() }), 0.85),
  water:    () => M(0x3b8fc4, { r: 0.05, m: 0.3 }),
  stone:    () => M(0xd9d4c7, { r: 0.9 }),
  soil:     () => M(0x5b4331, { r: 1 }),
  birch:    () => M(0xe9e6dc, { r: 0.9 }),
  railGlass:() => M(0xa9cfe6, { r: 0.1, m: 0.3, opacity: 0.5 }),
  lit:      () => nightGlow(M(0xffe7b0, { e: 0xffd98a, ei: 0.5, r: 0.4 }), 0.35, 2.6),
};

// ── Geometries ─────────────────────────────────────────────────────────────
const geoCache = {};
const gkey = (n, a) => n + a.map(v => +v.toFixed(4)).join(',');
export const G = {
  box:    (w, h, d)            => geoCache[gkey('b', [w, h, d])] ??= new THREE.BoxGeometry(w, h, d),
  cyl:    (rt, rb, h, s = 16, hs = 1, open = false) => geoCache[gkey('c', [rt, rb, h, s, +open])] ??= new THREE.CylinderGeometry(rt, rb, h, s, hs, open),
  sphere: (r, ws = 12, hs = 8, ...arc) => geoCache[gkey('s', [r, ws, hs, ...arc])] ??= new THREE.SphereGeometry(r, ws, hs, ...arc),
  cone:   (r, h, s = 12)       => geoCache[gkey('k', [r, h, s])] ??= new THREE.ConeGeometry(r, h, s),
  ico:    (r, d = 1)           => geoCache[gkey('i', [r, d])] ??= new THREE.IcosahedronGeometry(r, d),
  circle: (r, s = 24)          => geoCache[gkey('o', [r, s])] ??= new THREE.CircleGeometry(r, s).rotateX(-Math.PI / 2),
  plane:  (w, h)               => geoCache[gkey('p', [w, h])] ??= new THREE.PlaneGeometry(w, h),
  torus:  (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => geoCache[gkey('t', [r, t, rs, ts, arc])] ??= new THREE.TorusGeometry(r, t, rs, ts, arc),
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

/**
 * Box whose top face is shrunk to tw × td (and slid by tz along z).
 * Base at y=0. Used for hip roofs, car cabins, plinths and bevelled props.
 */
export function taperGeo(w, h, d, tw, td, tz = 0) {
  return geoCache[gkey('taper', [w, h, d, tw, td, tz])] ??= (() => {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * tw / w, h, p.getZ(i) * td / d + tz);
      else p.setY(i, 0);
    }
    g.computeVertexNormals();
    return g;
  })();
}

/** Lumpy unit sphere for foliage and rocks (four cached shapes). */
export function blobGeo(v = 0) {
  return geoCache['blob' + v] ??= (() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position, r = rng(977 + v * 131), seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let k = seen.get(key);
      if (k === undefined) seen.set(key, k = 0.8 + r() * 0.4);
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
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
 * roof on top (top: false leaves it open for a pitched roof). Window bays are `bay` wide and floors are `floor` tall, so the
 * texture lines up regardless of the block's size.
 */
const facadeMats = {};
function sliceGeo(src, ranges) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const at = src.attributes[name], n = at.itemSize, out = [];
    for (const [from, to] of ranges) for (let i = from * n; i < to * n; i++) out.push(at.array[i]);
    g.setAttribute(name, new THREE.Float32BufferAttribute(out, n));
  }
  return g;
}
function facadeGeos(w, h, d, bay, floor) {
  return geoCache[gkey('facade', [w, h, d, bay, floor])] ??= (() => {
    const box = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const uv = box.attributes.uv;
    // Face order: +x, -x, +y, -y, +z, -z (6 verts each)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const [du, dv] = dims[f];
      const cap = f === 2 || f === 3;
      // Whole bays and floors per face, so no window is ever cut at a corner
      const su = cap ? du : Math.max(1, Math.round(du / bay)) / 4;
      const sv = cap ? dv : Math.max(1, Math.round(dv / floor)) / 4;
      for (let i = f * 6; i < f * 6 + 6; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    return { side: sliceGeo(box, [[0, 12], [24, 36]]), cap: sliceGeo(box, [[12, 24]]) };
  })();
}
/** Returns the wall mesh. Walls and caps are plain meshes, so bake() merges them. */
export function facadeBlock(parent, w, h, d, x, y0, z, { style, wall, bay = 0.22, floor = 0.26, roofMat, top = true } = {}) {
  const tex = facadeTexture(style, wall);
  const side = facadeMats[tex.uuid] ??= nightGlow(new THREE.MeshStandardMaterial({
    map: tex,
    roughness: style === 'glass' || style === 'office' || style === 'tower' ? 0.3 : 0.85,
    metalness: style === 'glass' || style === 'tower' ? 0.35 : 0,
    emissive: 0xffffff, emissiveMap: tex.userData.glow,
  }), 0, 1.7);
  const geos = facadeGeos(w, h, d, bay, floor);
  const mesh = add(parent, geos.side, side, x, y0 + h / 2, z);
  if (top) add(parent, geos.cap, roofMat ?? MAT.roof(), x, y0 + h / 2, z);
  return mesh;
}

/**
 * Ground slab whose texture is laid out in lot space (k repeats per unit), so
 * paving and asphalt keep one scale whatever the slab's size or position.
 */
export function slab(parent, w, h, d, mat, x, y0, z, k = 1, o) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) + x, Y = p.getY(i), Z = p.getZ(i) + z;
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, X * k, -Z * k);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, Z * k, Y * k);
    else uv.setXY(i, X * k, Y * k);
  }
  return add(parent, geo, mat, x, y0 + h / 2, z, o);
}

/** Flat textured plane facing +z, rotated by ry (signs, doors). */
const panelMats = {};
export function texturedPanel(parent, w, h, tex, x, y, z, ry = 0, glow = 0) {
  const mat = panelMats[tex.uuid + glow] ??= (() => {
    const m = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.6,
      emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? tex : null, emissiveIntensity: glow,
    });
    return glow ? nightGlow(m, glow, glow * 2.5 + 0.4) : m;
  })();
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
// Foliage palettes run dark → light so a canopy can be shaded in three tones.
const LEAF = [0x2f6b2e, 0x3f7d36, 0x4f8f3a, 0x5fa043, 0x7fb24a];
const PINE = [0x285e35, 0x2f6b3b, 0x3a7a45];
const AUTUMN = [0xc4572a, 0xd98c2b, 0xe0b23a];
const SPRING = [0x7fc24a, 0x8fd060, 0x9bd45a, 0xa6d85a, 0xb4e06a];
const BLOSSOM = [0xe58fb4, 0xf2a7c3, 0xfbd0df];
const leafMat = c => M(c, { flat: true, r: 0.9 });

const _c = new THREE.Color(), _t = new THREE.Color();
const FROST = 0xe6ecf2, DRY = 0xdccf95;
/**
 * Seasonal look. Each value is 0–1:
 *   snow – winter cover, autumn – leaves turn, spring – fresh growth/blossom
 */
export function setSeason({ snow, autumn, spring }) {
  SNOW.value = snow * 0.92;
  LEAF.forEach((c, i) => {
    _c.setHex(c)
      .lerp(_t.setHex(SPRING[i]), spring * 0.45)
      .lerp(_t.setHex(AUTUMN[i % AUTUMN.length]), autumn * 0.9)
      .lerp(_t.setHex(FROST), snow * 0.8);
    leafMat(c).color.copy(_c);
  });
  for (const c of PINE)   leafMat(c).color.setHex(c).lerp(_t.setHex(FROST), snow * 0.45);
  for (const c of AUTUMN) leafMat(c).color.setHex(c).lerp(_t.setHex(FROST), snow * 0.8);
  // Blossom trees flower in spring, are green through summer and turn in autumn
  BLOSSOM.forEach((c, i) => {
    _c.setHex(LEAF[i + 2])
      .lerp(_t.setHex(c), spring)
      .lerp(_t.setHex(AUTUMN[i]), autumn * 0.9)
      .lerp(_t.setHex(FROST), snow * 0.8);
    leafMat(c).color.copy(_c);
  });
  _t.setHex(0xffffff).lerp(_c.setHex(DRY), autumn * 0.6);
  for (const { mat, base } of grassMats) mat.color.copy(base).multiply(_t);
}

// Unit geometries that props scale, so random sizes don't fill the cache
const UNIT = {
  cyl:  () => G.cyl(1, 1, 1, 7),
  cone: () => G.cone(1, 1, 7),
};
/** Tapered trunk from the ground up; returns the top position [x, y, z]. */
function trunk(g, h, r0, r1, mat, lean = 0, dir = 0) {
  const geo = geoCache[gkey('trunk', [r0, r1])] ??= new THREE.CylinderGeometry(r1, r0, 1, 7).translate(0, 0.5, 0);
  const m = add(g, geo, mat, 0, 0, 0, { s: [1, h, 1] });
  m.rotation.set(Math.cos(dir) * lean, 0, -Math.sin(dir) * lean);
  return [Math.sin(dir) * Math.sin(lean) * h, Math.cos(lean) * h, Math.cos(dir) * Math.sin(lean) * h];
}
function blob(g, r, rad, x, y, z, mat, sy = 0.86) {
  return add(g, blobGeo(Math.floor(r() * 4)), mat, x, y, z, { s: [rad, rad * sy, rad], ry: r() * 6.283 });
}
/** Broadleaf crown: a core, a ring of lobes (shaded low, lit high) and a cap. */
function crown(g, r, [dark, mid, light], x, y, z, size = 1, lobes = 5) {
  blob(g, r, 0.15 * size, x, y, z, mid);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * 6.283 + r() * 0.7;
    const rad = (0.085 + r() * 0.035) * size, dist = (0.09 + r() * 0.03) * size;
    const up = (r() - 0.45) * 0.1 * size;
    blob(g, r, rad, x + Math.cos(a) * dist, y + up - 0.02 * size, z + Math.sin(a) * dist, up < 0 ? dark : mid);
  }
  blob(g, r, 0.1 * size, x + (r() - 0.5) * 0.05, y + 0.1 * size, z + (r() - 0.5) * 0.05, light, 0.8);
}

/**
 * A stylised tree.
 * kind: 'round' | 'oak' | 'pine' | 'tall' | 'birch' | 'blossom' | 'autumn'
 */
export function tree(parent, x, z, s = 1, kind = 'round', r = Math.random) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = r() * Math.PI * 2;
  const bark = MAT.trunk();
  if (kind === 'pine') {
    const k = Math.floor(r() * 2);
    const tones = [leafMat(PINE[k]), leafMat(PINE[k + 1])];
    const tiers = 4 + Math.floor(r() * 2), slim = 0.85 + r() * 0.35, H = 0.46 + r() * 0.12;
    trunk(g, 0.2, 0.03, 0.016, bark);
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const rad = (0.175 - 0.115 * t) / slim, h = 0.2 - 0.05 * t;
      const y = 0.1 + t * (H - 0.2);
      add(g, UNIT.cone(), tones[i < tiers / 2 ? 0 : 1], (r() - 0.5) * 0.012, y + h / 2, (r() - 0.5) * 0.012,
        { s: [rad, h, rad], ry: r() * 6.283 });
    }
  } else if (kind === 'tall') {
    // Poplar / cypress column
    const k = 1 + Math.floor(r() * 2);
    const tones = [LEAF[k - 1], LEAF[k], LEAF[k], LEAF[k + 1], LEAF[k + 1]].map(leafMat);
    trunk(g, 0.16, 0.028, 0.02, bark);
    [0.085, 0.11, 0.105, 0.085, 0.055].forEach((rad, i) =>
      blob(g, r, rad, (r() - 0.5) * 0.02, 0.17 + i * 0.095, (r() - 0.5) * 0.02, tones[i], 1.25));
  } else if (kind === 'birch') {
    const white = MAT.birch(), band = M(0x3d3b37, { r: 0.9 });
    const h = 0.34 + r() * 0.06, lean = (r() - 0.5) * 0.16;
    const [tx, ty, tz] = trunk(g, h, 0.02, 0.011, white, lean, 0);
    for (const t of [0.22, 0.45, 0.63]) add(g, G.cyl(0.0165 - t * 0.006, 0.0165 - t * 0.006, 0.012, 7), band, tx * t, ty * t, tz * t);
    const tones = [leafMat(LEAF[2]), leafMat(LEAF[3]), leafMat(LEAF[4])];
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.283, d = 0.03 + r() * 0.05;
      blob(g, r, 0.06 + r() * 0.03, tx + Math.cos(a) * d, ty - 0.07 + i * 0.045, tz + Math.sin(a) * d, tones[Math.min(2, Math.floor(i / 2))], 1);
    }
  } else {
    const oak = kind === 'oak';
    const k = 1 + Math.floor(r() * 3);
    const tones = (kind === 'autumn' ? AUTUMN : kind === 'blossom' ? BLOSSOM : [LEAF[k - 1], LEAF[k], LEAF[Math.min(4, k + 2)]]).map(leafMat);
    const h = (oak ? 0.2 : 0.17) + r() * 0.06, lean = (r() - 0.5) * 0.14;
    add(g, UNIT.cone(), bark, 0, 0.02, 0, { s: [oak ? 0.065 : 0.048, 0.04, oak ? 0.065 : 0.048] }); // root flare
    const [tx, ty, tz] = trunk(g, h, oak ? 0.045 : 0.032, oak ? 0.028 : 0.019, bark, lean, 0);
    // Forked limbs disappearing into the crown
    for (const sgn of [-1, 1]) {
      add(g, UNIT.cyl(), bark, tx + sgn * 0.035, ty + 0.02, tz, { s: [0.01, 0.11, 0.01], rz: -sgn * 0.75 });
    }
    crown(g, r, tones, tx, ty + (oak ? 0.12 : 0.1), tz, oak ? 1.3 : kind === 'blossom' ? 0.9 : 1, oak ? 7 : 5);
  }
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

/** Shrub: a clump of two or three foliage blobs. */
export function bush(parent, x, z, s = 1, color = 0x4f8f3a) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat = leafMat(color);
  const r = rng(Math.round((x * 91.7 + z * 37.3) * 1000) + 7);
  blob(g, r, 0.06, 0, 0.045, 0, mat, 0.8);
  blob(g, r, 0.042, 0.045, 0.035, 0.012, mat, 0.8);
  if (r() < 0.6) blob(g, r, 0.038, -0.035, 0.03, -0.03, mat, 0.8);
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

export function hedge(parent, w, d, x, z) {
  const mat = M(0x3f7d36, { r: 0.95 });
  return add(parent, taperGeo(w, 0.075, d, w - 0.012, Math.max(0.01, d - 0.02)), mat, x, 0.02, z);
}

const PETALS = [0xe84393, 0xfdcb6e, 0xffffff, 0xd63031, 0x9b6bdf, 0xff9f43];
/** Soil bed with a scatter of flowers. */
export function flowerBed(parent, x, z, w, d, r = Math.random, y = 0.03) {
  boxAt(parent, w, 0.012, d, MAT.soil(), x, y, z, { shadow: false });
  const n = Math.max(3, Math.round(w * d * 420));
  const cols = [pick(PETALS, r), pick(PETALS, r)];
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * (w - 0.02), fz = z + (r() - 0.5) * (d - 0.02);
    add(parent, G.ico(0.013, 0), M(cols[i % 2], { flat: true, r: 0.8 }), fx, y + 0.028, fz, { shadow: false });
    if (i % 2) add(parent, G.ico(0.012, 0), leafMat(LEAF[2]), fx + 0.012, y + 0.018, fz + 0.008, { shadow: false });
  }
}

/** Low-poly boulder. */
export function rock(parent, x, z, s = 1, r = Math.random, color = 0x8d8d86) {
  return add(parent, blobGeo(Math.floor(r() * 4)), M(color, { flat: true, r: 1 }), x, 0.035 * s, z,
    { s: [0.07 * s * (0.8 + r() * 0.5), 0.05 * s, 0.07 * s], ry: r() * 6.283 });
}

export function streetLamp(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  const dm = MAT.darkMetal();
  add(g, G.cyl(0.018, 0.024, 0.04, 8), dm, 0, 0.02, 0);
  add(g, G.cyl(0.008, 0.012, 0.42, 6), dm, 0, 0.23, 0);
  // Swan-neck arm
  add(g, G.cyl(0.006, 0.006, 0.06, 5), dm, 0, 0.455, 0.018, { rx: 0.7 });
  add(g, G.cyl(0.006, 0.006, 0.07, 5), dm, 0, 0.478, 0.068, { rx: Math.PI / 2 });
  add(g, taperGeo(0.045, 0.014, 0.07, 0.03, 0.05), dm, 0, 0.468, 0.1);
  add(g, G.box(0.034, 0.008, 0.056), nightGlow(M(0xfff3c4, { e: 0xffe9a0, ei: 0.8 }), 0.3, 3.5), 0, 0.464, 0.1, { shadow: false });
  parent.add(g);
  return g;
}

export function bench(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  const wood = MAT.wood(), dm = MAT.darkMetal();
  for (const sz of [-0.014, 0.014]) boxAt(g, 0.15, 0.008, 0.022, wood, 0, 0.042, sz);
  for (const sy of [0.062, 0.084]) add(g, G.box(0.15, 0.016, 0.006), wood, 0, sy, -0.03, { rx: -0.18 });
  for (const sx of [-0.062, 0.062]) {
    boxAt(g, 0.008, 0.042, 0.05, dm, sx, 0, 0);
    boxAt(g, 0.008, 0.008, 0.05, dm, sx, 0.068, 0);
    boxAt(g, 0.008, 0.06, 0.008, dm, sx, 0.04, -0.028);
  }
  parent.add(g);
  return g;
}

export function flagpole(parent, x, z, flagColor = 0xc0392b, h = 0.6) {
  add(parent, G.cyl(0.022, 0.028, 0.025, 8), MAT.concrete(), x, 0.0125, z);
  add(parent, G.cyl(0.006, 0.01, h, 6), MAT.metal(), x, h / 2, z);
  add(parent, G.sphere(0.014, 8, 6), M(0xd4af37, { m: 0.8, r: 0.3 }), x, h + 0.01, z);
  const flag = add(parent, G.box(0.14, 0.085, 0.004), M(flagColor, { r: 0.8 }), x + 0.075, h - 0.05, z);
  flag.userData.noBake = true;
  flag.userData.flag = true;
  return flag;
}

export function trashBin(parent, x, z, y = 0) {
  add(parent, G.cyl(0.02, 0.016, 0.05, 8), M(0x3d5a48, { r: 0.7 }), x, y + 0.025, z);
  add(parent, G.cyl(0.022, 0.022, 0.008, 8), MAT.darkMetal(), x, y + 0.054, z);
}

export function hydrant(parent, x, z, y = 0) {
  const red = M(0xd63a2f, { r: 0.5 });
  add(parent, G.cyl(0.013, 0.016, 0.05, 8), red, x, y + 0.025, z);
  add(parent, G.sphere(0.014, 8, 6), red, x, y + 0.052, z);
  add(parent, G.cyl(0.006, 0.006, 0.044, 6), red, x, y + 0.034, z, { rz: Math.PI / 2 });
}

export function mailbox(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  boxAt(g, 0.01, 0.07, 0.01, MAT.wood(), 0, 0, 0);
  boxAt(g, 0.028, 0.024, 0.045, M(0x2e4a62, { r: 0.5 }), 0, 0.07, 0);
  boxAt(g, 0.004, 0.02, 0.012, M(0xd63a2f), 0.016, 0.082, 0.008);
  parent.add(g);
  return g;
}

/** Tub planter with a shrub or small flowers. */
export function planter(parent, x, z, y = 0, color = 0x4f8f3a, s = 1) {
  add(parent, taperGeo(0.07 * s, 0.045 * s, 0.07 * s, 0.085 * s, 0.085 * s), M(0x8a7460, { r: 0.9 }), x, y, z);
  const b = bush(parent, x, z, 0.75 * s, color);
  b.position.y = y + 0.035 * s;
  return b;
}

export function bikeRack(parent, x, z, ry = 0, r = Math.random) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  const dm = MAT.metal();
  for (let i = 0; i < 3; i++) {
    const bx = (i - 1) * 0.045;
    add(g, G.torus(0.022, 0.003, 4, 10, Math.PI), dm, bx, 0.002, 0, { ry: Math.PI / 2 });
    if (r() < 0.65) {
      // Parked bicycle: two wheels and a frame
      const col = M(pick(CAR_COLORS, r), { r: 0.5 });
      for (const wz of [-0.03, 0.03]) add(g, G.torus(0.017, 0.003, 4, 10), MAT.rubber(), bx + 0.012, 0.02, wz, { ry: Math.PI / 2 });
      add(g, G.box(0.004, 0.004, 0.06), col, bx + 0.012, 0.034, 0, {});
      add(g, G.box(0.004, 0.022, 0.004), col, bx + 0.012, 0.04, -0.012);
      add(g, G.box(0.022, 0.004, 0.004), col, bx + 0.012, 0.05, 0.026);
    }
  }
  parent.add(g);
  return g;
}

export function picnicTable(parent, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  const wood = MAT.wood();
  boxAt(g, 0.13, 0.008, 0.07, wood, 0, 0.052, 0);
  for (const sz of [-0.055, 0.055]) boxAt(g, 0.13, 0.007, 0.024, wood, 0, 0.03, sz);
  for (const sx of [-0.045, 0.045]) {
    boxAt(g, 0.008, 0.052, 0.012, wood, sx, 0, 0);
    boxAt(g, 0.008, 0.008, 0.13, wood, sx, 0.024, 0);
  }
  parent.add(g);
  return g;
}

/** Café table with a parasol and two stools. */
export function parasolTable(parent, x, z, color = 0xf39c12, y = 0) {
  const dm = MAT.darkMetal();
  add(parent, G.cyl(0.034, 0.034, 0.006, 10), MAT.white(), x, y + 0.056, z);
  add(parent, G.cyl(0.004, 0.004, 0.17, 5), dm, x, y + 0.085, z);
  add(parent, G.cyl(0.014, 0.014, 0.006, 8), dm, x, y + 0.003, z);
  add(parent, G.cone(0.075, 0.035, 8), M(color, { r: 0.8 }), x, y + 0.165, z);
  add(parent, G.cyl(0.076, 0.076, 0.006, 8), M(0xfdf8ec, { r: 0.8 }), x, y + 0.148, z);
  for (const [dx, dz] of [[0.05, 0.02], [-0.045, -0.03]]) add(parent, G.cyl(0.012, 0.012, 0.03, 6), M(0x6b4b34), x + dx, y + 0.015, z + dz);
}

/** Line of posts and rails from (x1,z1) to (x2,z2). kind: 'picket' | 'rail' | 'chain' */
export function fence(parent, x1, z1, x2, z2, kind = 'picket', y = 0.03, gap = null) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const mat = kind === 'picket' ? MAT.white() : kind === 'rail' ? MAT.wood() : MAT.metal();
  const h = kind === 'chain' ? 0.1 : kind === 'rail' ? 0.06 : 0.07;
  const step = kind === 'picket' ? 0.042 : 0.14;
  const n = Math.max(1, Math.round(len / step));
  const skip = t => gap && Math.abs(t * len - gap[0]) < gap[1];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (skip(t)) continue;
    boxAt(parent, kind === 'picket' ? 0.012 : 0.01, h, kind === 'picket' ? 0.008 : 0.01, mat, x1 + dx * t, y, z1 + dz * t, { ry });
  }
  if (gap) return;
  if (kind === 'chain') {
    add(parent, G.box(len, h * 0.82, 0.003), M(0xc7ccd1, { opacity: 0.35, r: 0.5, m: 0.6 }), cx, y + h * 0.5, cz, { ry, shadow: false });
    add(parent, G.box(len, 0.006, 0.006), mat, cx, y + h, cz, { ry });
  } else {
    for (const ry0 of kind === 'picket' ? [0.045] : [0.025, 0.05]) add(parent, G.box(len, 0.01, 0.006), mat, cx, y + ry0, cz, { ry });
  }
}

/** Traffic signal on a mast; the lit head faces +z before rotation. */
export function trafficLight(parent, x, z, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const dm = MAT.darkMetal();
  add(g, G.cyl(0.007, 0.01, 0.3, 6), dm, 0, 0.15, 0);
  boxAt(g, 0.03, 0.075, 0.024, M(0x22252a, { r: 0.6 }), 0, 0.26, 0.012);
  const lamps = [[0xff3b30, 0.318], [0xffc400, 0.297], [0x2ecc71, 0.276]];
  lamps.forEach(([c, ly], i) => add(g, G.sphere(0.008, 6, 4),
    M(c, { e: c, ei: i === 2 ? 1.6 : 0.25 }), 0, ly, 0.026, { shadow: false }));
  parent.add(g);
  return g;
}

export function busShelter(parent, x, z, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const dm = MAT.darkMetal();
  for (const sx of [-0.1, 0.1]) boxAt(g, 0.008, 0.15, 0.008, dm, sx, 0, -0.03);
  boxAt(g, 0.2, 0.11, 0.004, MAT.railGlass(), 0, 0.03, -0.03, { shadow: false });
  boxAt(g, 0.23, 0.01, 0.09, M(0x2f6fb0, { r: 0.5 }), 0, 0.15, 0);
  boxAt(g, 0.14, 0.008, 0.025, MAT.wood(), 0, 0.04, -0.012);
  boxAt(g, 0.008, 0.19, 0.008, dm, 0.14, 0, 0.02);
  boxAt(g, 0.035, 0.035, 0.006, M(0x2f6fb0, { r: 0.5 }), 0.14, 0.17, 0.02);
  parent.add(g);
  return g;
}

/** Tilted photovoltaic array on a frame, cols × rows panels. */
export function solarPanels(parent, x, y, z, cols = 2, rows = 1, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const cell = M(0x1d3557, { r: 0.2, m: 0.6 }), frame = MAT.metal();
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = (i - (cols - 1) / 2) * 0.085, pz = (j - (rows - 1) / 2) * 0.075;
    add(g, G.box(0.08, 0.004, 0.06), frame, px, 0.03, pz, { rx: 0.42 });
    add(g, G.box(0.074, 0.005, 0.054), cell, px, 0.0315, pz, { rx: 0.42 });
    boxAt(g, 0.006, 0.04, 0.006, frame, px, 0, pz - 0.022);
  }
  parent.add(g);
  return g;
}

export function satelliteDish(parent, x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s);
  add(g, G.cyl(0.005, 0.005, 0.04, 5), MAT.darkMetal(), 0, 0.02, 0);
  add(g, G.cone(0.036, 0.014, 10), MAT.white(), 0, 0.058, 0.006, { rx: -2.3 });
  add(g, G.cyl(0.002, 0.002, 0.04, 4), MAT.darkMetal(), 0, 0.058, 0.026, { rx: 0.95 });
  parent.add(g);
  return g;
}

/** Boxy air-handling unit with a fan grille. */
export function acUnit(parent, x, y, z, s = 1, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s);
  boxAt(g, 0.1, 0.055, 0.075, MAT.metal(), 0, 0.008, 0);
  for (const sx of [-0.04, 0.04]) boxAt(g, 0.01, 0.008, 0.07, MAT.darkMetal(), sx, 0, 0);
  add(g, G.cyl(0.026, 0.026, 0.006, 10), MAT.darkMetal(), 0.018, 0.066, 0);
  add(g, G.box(0.03, 0.03, 0.002), MAT.darkMetal(), -0.03, 0.036, 0.0385);
  parent.add(g);
  return g;
}

const CAR_COLORS = [0xd63031, 0x0984e3, 0xfdcb6e, 0xf5f6fa, 0x2d3436, 0x00b894, 0xe17055, 0x6c5ce7, 0xb2bec3, 0x1f7a5c, 0x8e9aa6];

/**
 * Small vehicle facing +z. kind: 'sedan' | 'hatch' | 'taxi' | 'pickup' | 'van'
 * | 'truck' | 'bus' | 'police' | 'firetruck'
 * Static parts are merged, so a car costs a handful of draw calls.
 */
export function vehicle(kind = 'sedan', color = null, r = Math.random) {
  const g = new THREE.Group();
  const c = color ?? (kind === 'taxi' ? 0xf7c325 : pick(CAR_COLORS, r));
  const paint = M(c, { r: 0.3, m: 0.45 });
  const glassM = MAT.darkGlass(), dark = MAT.rubber(), chrome = MAT.metal();
  const heavy = kind === 'bus' || kind === 'truck' || kind === 'firetruck';
  const wr = heavy ? 0.036 : 0.032;
  const y0 = wr * 0.7;

  let L = 0.36, W = 0.18;
  if (kind === 'hatch')  L = 0.31;
  if (kind === 'pickup') L = 0.4;
  if (kind === 'van')    { L = 0.4; W = 0.19; }
  if (kind === 'bus')    { L = 0.64; W = 0.2; }
  if (kind === 'truck' || kind === 'firetruck') { L = 0.54; W = 0.2; }
  let top = y0; // height of the highest fixed part, for roof accessories

  /** Glasshouse: dark tapered greenhouse with a painted roof panel. */
  const cabin = (l, z, h, frontRake, rearRake, w = W * 0.92) => {
    const tl = l - frontRake - rearRake, tz = (rearRake - frontRake) / 2;
    add(g, taperGeo(w, h, l, w * 0.84, tl, tz), glassM, 0, top, z);
    boxAt(g, w * 0.85, 0.008, tl + 0.006, paint, 0, top + h - 0.003, z + tz);
    // Pillars keep the glass from reading as one black block
    for (const sx of [-1, 1]) boxAt(g, 0.006, h * 0.95, 0.012, paint, sx * w * 0.455, top, z + tz * 0.6, { rz: sx * 0.12 });
    return top + h;
  };

  if (kind === 'bus') {
    boxAt(g, W, 0.15, L, paint, 0, y0, 0);
    boxAt(g, W * 1.012, 0.05, L * 0.88, glassM, 0, y0 + 0.078, -0.01);
    boxAt(g, W * 0.9, 0.075, 0.008, glassM, 0, y0 + 0.055, L / 2);
    boxAt(g, W * 1.014, 0.014, L * 0.99, M(0xfafafa, { r: 0.5 }), 0, y0 + 0.04, 0);
    boxAt(g, W * 0.94, 0.012, L * 0.95, M(0xf2f0ea, { r: 0.6 }), 0, y0 + 0.15, 0);
    boxAt(g, W * 0.5, 0.02, 0.14, MAT.metal(), 0, y0 + 0.16, -0.08);
    for (const dz of [L / 2 - 0.1, -0.04]) boxAt(g, 0.004, 0.105, 0.05, dark, W / 2 + 0.001, y0 + 0.012, dz);
    top = y0 + 0.16;
  } else if (kind === 'truck' || kind === 'firetruck') {
    const fire = kind === 'firetruck';
    boxAt(g, W * 0.86, 0.03, L, MAT.darkMetal(), 0, y0, 0);
    const cl = fire ? 0.16 : 0.13, cz = L / 2 - cl / 2;
    boxAt(g, W, 0.085, cl, paint, 0, y0 + 0.015, cz);
    add(g, taperGeo(W * 0.98, 0.05, cl, W * 0.9, cl - 0.035, -0.012), glassM, 0, y0 + 0.1, cz);
    boxAt(g, W * 0.9, 0.008, cl - 0.03, paint, 0, y0 + 0.147, cz - 0.012);
    if (fire) {
      boxAt(g, W, 0.095, 0.37, paint, 0, y0 + 0.015, -0.085);
      boxAt(g, W * 1.012, 0.016, L * 0.98, M(0xf7f5ee, { r: 0.5 }), 0, y0 + 0.04, 0);
      for (const sx of [-1, 1]) for (const dz of [-0.2, -0.09, 0.02])
        boxAt(g, 0.004, 0.045, 0.09, MAT.metal(), sx * (W / 2 + 0.001), y0 + 0.06, dz);
      // Turntable ladder
      add(g, G.cyl(0.04, 0.04, 0.014, 10), MAT.darkMetal(), 0, y0 + 0.117, -0.2);
      for (const sx of [-0.035, 0.035]) add(g, G.box(0.007, 0.007, 0.44), chrome, sx, y0 + 0.14, -0.03, { rx: -0.05 });
      for (let i = 0; i < 9; i++) add(g, G.box(0.07, 0.005, 0.005), chrome, 0, y0 + 0.129 + i * 0.0024, -0.23 + i * 0.05);
      boxAt(g, 0.13, 0.016, 0.03, M(0xff3b30, { e: 0xff2a1a, ei: 1.2 }), 0, y0 + 0.155, cz - 0.01, { shadow: false });
      add(g, G.cyl(0.014, 0.014, 0.1, 8), M(0xe8d9a0, { r: 0.8 }), W / 2 + 0.004, y0 + 0.085, -0.1, { rx: Math.PI / 2 });
    } else {
      const box = M(pick([0xecf0f1, 0xd35400, 0x2980b9, 0x2e8b57, 0xf2c14e], r), { r: 0.6 });
      boxAt(g, W * 1.04, 0.165, 0.37, box, 0, y0 + 0.03, -0.075);
      boxAt(g, W * 1.05, 0.03, 0.372, M(0xffffff, { r: 0.6 }), 0, y0 + 0.1, -0.075);
      for (const dz of [-0.2, -0.075, 0.05]) boxAt(g, W * 1.052, 0.165, 0.006, MAT.metal(), 0, y0 + 0.03, dz);
      boxAt(g, W * 0.8, 0.012, 0.03, dark, 0, y0 + 0.015, -L / 2 + 0.01);
    }
    top = y0 + 0.195;
  } else if (kind === 'van') {
    boxAt(g, W, 0.075, L, paint, 0, y0, 0);
    add(g, taperGeo(W * 0.98, 0.085, L * 0.84, W * 0.9, L * 0.7, -0.02), paint, 0, y0 + 0.075, -0.03);
    add(g, G.box(W * 0.84, 0.062, 0.006), glassM, 0, y0 + 0.115, L * 0.39 - 0.045, { rx: -0.42 });
    for (const sx of [-1, 1]) boxAt(g, 0.004, 0.04, 0.075, glassM, sx * (W * 0.475), y0 + 0.09, L * 0.39 - 0.11, { rz: sx * 0.06 });
    boxAt(g, W * 1.008, 0.012, L * 0.6, M(pick([0xffffff, 0x2d3436, 0xe17055], r), { r: 0.5 }), 0, y0 + 0.045, -0.06);
    top = y0 + 0.16;
  } else {
    // Cars: lower body with a hood line, then a raked glasshouse
    add(g, taperGeo(W, 0.07, L, W * 0.96, L * 0.985), paint, 0, y0, 0);
    boxAt(g, W * 1.01, 0.012, L * 0.62, dark, 0, y0 - 0.004, 0);
    top = y0 + 0.07;
    if (kind === 'hatch') top = cabin(0.2, -0.045, 0.062, 0.05, 0.02);
    else if (kind === 'pickup') {
      const bedTop = top;
      top = cabin(0.14, 0.03, 0.062, 0.035, 0.012);
      for (const sx of [-1, 1]) boxAt(g, 0.008, 0.03, 0.15, paint, sx * (W / 2 - 0.006), bedTop - 0.002, -0.115);
      boxAt(g, W - 0.01, 0.03, 0.008, paint, 0, bedTop - 0.002, -L / 2 + 0.008);
      boxAt(g, W - 0.024, 0.004, 0.14, dark, 0, bedTop, -0.115);
      if (r() < 0.6) boxAt(g, 0.07, 0.035, 0.06, MAT.wood(), 0.02, bedTop + 0.004, -0.11);
    } else top = cabin(0.2, -0.02, 0.06, 0.045, 0.04);
    for (const sx of [-1, 1]) boxAt(g, 0.014, 0.01, 0.012, paint, sx * (W / 2 + 0.004), y0 + 0.072, kind === 'hatch' ? 0.03 : 0.055);
    if (kind === 'taxi') {
      boxAt(g, 0.05, 0.016, 0.02, nightGlow(M(0xfff6c8, { e: 0xffe27a, ei: 0.6 }), 0.5, 2.5), 0, top + 0.004, -0.02, { shadow: false });
      boxAt(g, W * 1.012, 0.012, L * 0.5, M(0x1e1e1e, { r: 0.5 }), 0, y0 + 0.04, -0.01);
    }
    if (kind === 'police') {
      boxAt(g, W * 1.012, 0.04, 0.15, M(0xffffff, { r: 0.4 }), 0, y0 + 0.016, -0.02);
      boxAt(g, 0.1, 0.006, 0.02, MAT.darkMetal(), 0, top + 0.004, -0.02);
      const red  = add(g, G.box(0.04, 0.018, 0.026), M(0xff2d2d, { e: 0xff0000, ei: 1.5 }), -0.027, top + 0.018, -0.02, { shadow: false });
      const blue = add(g, G.box(0.04, 0.018, 0.026), M(0x2d6bff, { e: 0x0050ff, ei: 1.5 }),  0.027, top + 0.018, -0.02, { shadow: false });
      red.userData.noBake = blue.userData.noBake = true;
      g.userData.siren = [red, blue];
    }
  }

  // Bumpers and grille
  boxAt(g, W * 1.02, 0.02, 0.014, dark, 0, y0 - 0.002, L / 2 + 0.002);
  boxAt(g, W * 1.02, 0.02, 0.014, dark, 0, y0 - 0.002, -L / 2 - 0.002);
  if (!heavy) boxAt(g, W * 0.4, 0.016, 0.004, MAT.darkMetal(), 0, y0 + 0.028, L / 2 + 0.001);
  // Wheels with hub caps
  const tyre = G.cyl(wr, wr, 0.03, 12), hub = G.cyl(wr * 0.5, wr * 0.5, 0.034, 8);
  const axles = heavy ? [L / 2 - 0.1, -L / 2 + 0.1] : [L / 2 - 0.075, -L / 2 + 0.075];
  if (kind === 'truck' || kind === 'firetruck') axles.push(-L / 2 + 0.185);
  for (const az of axles) for (const sx of [-1, 1]) {
    add(g, tyre, dark, sx * (W / 2 - 0.006), wr, az, { rz: Math.PI / 2 });
    add(g, hub, chrome, sx * (W / 2 - 0.006), wr, az, { rz: Math.PI / 2 });
  }
  // Lights
  const head = nightGlow(M(0xfffbe6, { e: 0xfff2c0, ei: 0.8 }), 0.6, 3.5);
  const tail = nightGlow(M(0xff3b30, { e: 0xff1a0a, ei: 0.6 }), 0.5, 2.5);
  const ly = y0 + (heavy ? 0.03 : 0.038);
  for (const sx of [-W * 0.34, W * 0.34]) {
    add(g, G.box(0.036, 0.018, 0.006), head, sx, ly, L / 2 + 0.003, { shadow: false });
    add(g, G.box(0.036, 0.016, 0.006), tail, sx, ly, -L / 2 - 0.003, { shadow: false });
  }
  return bake(g);
}

export function randomTrafficKind(r = Math.random) {
  const v = r();
  if (v < 0.36) return 'sedan';
  if (v < 0.58) return 'hatch';
  if (v < 0.66) return 'taxi';
  if (v < 0.75) return 'pickup';
  if (v < 0.87) return 'van';
  if (v < 0.95) return 'truck';
  return 'bus';
}

/**
 * Rooftop clutter. Items are dealt onto a grid of slots so nothing overlaps:
 * air handlers, vents, a stair bulkhead, water tank, solar array, dish, mast.
 */
export function rooftop(parent, w, d, y, r = Math.random, cx = 0, cz = 0) {
  const nx = Math.max(1, Math.floor((w - 0.06) / 0.2)), nz = Math.max(1, Math.floor((d - 0.06) / 0.18));
  const slots = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    slots.push([cx + ((i + 0.5) / nx - 0.5) * (w - 0.08), cz + ((j + 0.5) / nz - 0.5) * (d - 0.08)]);
  }
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  const items = ['ac', 'bulkhead', 'vents', 'ac', 'tank', 'solar', 'dish', 'mast'];
  const n = Math.min(slots.length, 2 + Math.floor(r() * 3));
  const start = Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const [x, z] = slots[k];
    const item = items[(start + k * 3) % items.length];
    if (item === 'ac') acUnit(parent, x, y, z, 1, r() < 0.5 ? 0 : Math.PI / 2);
    else if (item === 'bulkhead') {
      boxAt(parent, 0.13, 0.11, 0.12, MAT.concrete(), x, y, z);
      boxAt(parent, 0.14, 0.012, 0.13, MAT.darkMetal(), x, y + 0.11, z);
      boxAt(parent, 0.045, 0.08, 0.004, M(0x5b6570, { r: 0.6 }), x, y, z + 0.061);
    } else if (item === 'vents') {
      for (const [dx, dz] of [[-0.03, 0.02], [0.03, -0.02], [0.01, 0.04]]) {
        add(parent, G.cyl(0.012, 0.012, 0.05, 6), MAT.metal(), x + dx, y + 0.025, z + dz);
        add(parent, G.cone(0.02, 0.014, 6), MAT.darkMetal(), x + dx, y + 0.057, z + dz);
      }
    } else if (item === 'tank') {
      for (const [lx, lz] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03]])
        boxAt(parent, 0.008, 0.06, 0.008, MAT.darkMetal(), x + lx, y, z + lz);
      add(parent, G.cyl(0.05, 0.05, 0.09, 12), MAT.wood(), x, y + 0.105, z);
      for (const by of [0.075, 0.135]) add(parent, G.cyl(0.052, 0.052, 0.008, 12), MAT.darkMetal(), x, y + by, z);
      add(parent, G.cone(0.056, 0.04, 12), MAT.darkMetal(), x, y + 0.17, z);
    } else if (item === 'solar') solarPanels(parent, x, y, z, 2, 1, 0);
    else if (item === 'dish') satelliteDish(parent, x, y, z, r() * 6.283);
    else {
      add(parent, G.cyl(0.004, 0.006, 0.2, 5), MAT.metal(), x, y + 0.1, z);
      for (const ay of [0.13, 0.17]) add(parent, G.box(0.05, 0.004, 0.004), MAT.metal(), x, y + ay, z);
    }
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
    m.userData.ownsGeometry = true;
    group.add(m);
  }
  return group;
}
