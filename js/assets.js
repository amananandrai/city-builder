/**
 * assets.js — Kenney CC0 GLB asset loader
 *
 * Models are 1×1 unit footprint, y=0 base. Our CELL=1.2 so scale 1.0 fits
 * with a small gap (good for visual separation between tiles).
 *
 * Texture: all models share assets/models/Textures/colormap.png (relative URI
 * resolved automatically by GLTFLoader relative to the model URL).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODELS_PATH = 'assets/models/';
const loader = new GLTFLoader();

// Raw loaded GLTF scenes, keyed by filename
const gltfCache = {};

// ── Preload ────────────────────────────────────────────────────────────────
const MODEL_FILES = [
  'building-small-a.glb',
  'building-small-b.glb',
  'building-small-c.glb',
  'building-small-d.glb',
  'building-garage.glb',
  'grass-trees.glb',
  'grass-trees-tall.glb',
  'pavement-fountain.glb',
  'road-straight.glb',
];

export function preloadAssets() {
  return Promise.all(
    MODEL_FILES.map(file =>
      new Promise(resolve => {
        loader.load(
          MODELS_PATH + file,
          gltf => {
            // Prepare all meshes for shadows
            gltf.scene.traverse(c => {
              if (c.isMesh) {
                c.castShadow    = true;
                c.receiveShadow = true;
              }
            });
            gltfCache[file] = gltf.scene;
            resolve();
          },
          undefined,
          err => { console.warn('Failed to load', file, err); resolve(); }
        );
      })
    )
  );
}

// ── Clone a loaded model ───────────────────────────────────────────────────
// Uses THREE's SkeletonUtils-style deep clone so materials are independent.
export function cloneModel(file, tintHex = null, scale = 1.0) {
  const original = gltfCache[file];
  if (!original) return null;

  // Deep clone — clone(true) recursively clones children
  const clone = original.clone(true);

  // Clone materials so tinting doesn't affect the cached original
  clone.traverse(c => {
    if (!c.isMesh) return;
    c.castShadow    = true;
    c.receiveShadow = true;

    // Always clone the material so we can mutate it safely
    if (Array.isArray(c.material)) {
      c.material = c.material.map(m => m.clone());
    } else {
      c.material = c.material.clone();
    }

    // Apply tint: multiply the existing texture colour by the tint
    if (tintHex !== null) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        m.color.setHex(tintHex);
      });
    }
  });

  clone.scale.setScalar(scale);
  return clone;
}

// ── Zone → model mapping ───────────────────────────────────────────────────
const RESIDENTIAL_POOL = [
  'building-small-a.glb',
  'building-small-b.glb',
  'building-small-c.glb',
  'building-small-d.glb',
];

// Returns { file, tint, scale } for a given zone type
export function modelConfig(type) {
  switch (type) {
    case 'residential':
      return { file: RESIDENTIAL_POOL[Math.floor(Math.random() * RESIDENTIAL_POOL.length)], tint: null,       scale: 1.0 };
    case 'commercial':
      return { file: 'building-small-c.glb',   tint: null,       scale: 1.0 };
    case 'industrial':
      return { file: 'building-garage.glb',     tint: null,       scale: 1.0 };
    case 'park':
      return { file: Math.random() > 0.5 ? 'grass-trees.glb' : 'grass-trees-tall.glb', tint: null, scale: 1.0 };
    case 'school':
      return { file: 'building-small-b.glb',    tint: 0x1abc9c,   scale: 1.0 };
    case 'government':
      return { file: 'building-small-c.glb',    tint: 0xc0392b,   scale: 1.0 };
    case 'police':
      return { file: 'building-small-a.glb',    tint: 0x2471a3,   scale: 1.0 };
    case 'fire':
      return { file: 'building-small-d.glb',    tint: 0xe74c3c,   scale: 1.0 };
    default:
      return null;
  }
}

// ── Audio ──────────────────────────────────────────────────────────────────
let audioCtx = null;
const audioCache = {};

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

async function loadSound(path) {
  if (audioCache[path]) return;
  try {
    const res  = await fetch(path);
    const buf  = await res.arrayBuffer();
    audioCache[path] = await getCtx().decodeAudioData(buf);
  } catch (e) { /* silent fail */ }
}

export async function preloadAudio() {
  await Promise.all([
    loadSound('assets/sounds/placement-a.ogg'),
    loadSound('assets/sounds/placement-b.ogg'),
    loadSound('assets/sounds/removal-a.ogg'),
  ]);
}

function play(path, vol = 0.4) {
  const buf = audioCache[path];
  if (!buf) return;
  try {
    const ctx = getCtx();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch (e) { /* ignore */ }
}

const PLACE_SOUNDS = ['assets/sounds/placement-a.ogg', 'assets/sounds/placement-b.ogg'];
export function playPlacement() {
  play(PLACE_SOUNDS[Math.floor(Math.random() * PLACE_SOUNDS.length)], 0.35);
}
export function playRemoval() {
  play('assets/sounds/removal-a.ogg', 0.3);
}
