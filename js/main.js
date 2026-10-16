import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GRID, CELL, ZONE_DEF, TICK_MS } from './constants.js';
import { state, getTile, setTile, tileKey, resetState } from './state.js';
import { buildTileMesh, getMat } from './meshes.js';
import { updatePower, updateRoadConnectivity, calcStats, tick } from './simulation.js';
import { updateHUD, showAlert, showTooltip, initToolbar, initWelcome,
         initLevelComplete, buildLevelSelect, registerStartLevel } from './ui.js';
import { getLevel, ERAS } from './levels.js';
import { preloadAssets, preloadAudio, playPlacement, playRemoval } from './assets.js';

// ═══════════════════════════════════════════════
//  RENDERER & SCENE  (created once, reused across levels)
// ═══════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
camera.position.set(16, 18, 22);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
sun.position.set(12, 24, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-22, right:22, top:22, bottom:-22, near:1, far:70 });
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2.1;

// ── Static scene objects ──
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID * CELL + 6, GRID * CELL + 6),
  new THREE.MeshLambertMaterial({ color: 0x3a7d44 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(GRID * CELL, GRID, 0x2d6a4f, 0x2d6a4f);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const hitPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID * CELL, GRID * CELL),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
hitPlane.rotation.x = -Math.PI / 2;
hitPlane.position.y = 0.02;
scene.add(hitPlane);

// Hover highlight
const hoverMesh = new THREE.Mesh(
  new THREE.BoxGeometry(CELL * 0.96, 0.05, CELL * 0.96),
  new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.45 })
);
hoverMesh.visible = false;
scene.add(hoverMesh);

// Car group
const carGroup = new THREE.Group();
scene.add(carGroup);

// ═══════════════════════════════════════════════
//  COORDINATE HELPERS
// ═══════════════════════════════════════════════
function worldPos(gx, gz) {
  return new THREE.Vector3(
    (gx - GRID / 2 + 0.5) * CELL, 0,
    (gz - GRID / 2 + 0.5) * CELL
  );
}

function gridFromWorld(wx, wz) {
  const gx = Math.floor(wx / CELL + GRID / 2);
  const gz = Math.floor(wz / CELL + GRID / 2);
  if (gx < 0 || gx >= GRID || gz < 0 || gz >= GRID) return null;
  return { x: gx, z: gz };
}

// ═══════════════════════════════════════════════
//  CLEAR CITY (between levels)
// ═══════════════════════════════════════════════
function clearCity() {
  for (const k in state.tiles) {
    if (state.tiles[k].mesh) scene.remove(state.tiles[k].mesh);
  }
  // Remove all cars
  state.cars.forEach(c => carGroup.remove(c.mesh));
}

// ═══════════════════════════════════════════════
//  TILE PLACEMENT & DEMOLISH
// ═══════════════════════════════════════════════
function placeTile(gx, gz, type) {
  const def  = ZONE_DEF[type];
  if (!def) return;

  // Apply level cost multiplier
  const mult = getLevel(state.currentLevel).constraints.costMult;
  const cost = Math.round(def.cost * mult);

  if (state.money < cost) {
    showAlert(`💸 Need $${cost.toLocaleString()} for ${def.label}`, 'warn');
    return;
  }

  const existing = getTile(gx, gz);
  if (existing?.mesh) scene.remove(existing.mesh);

  state.money -= cost;

  const mesh = buildTileMesh(type);
  mesh.position.copy(worldPos(gx, gz));
  scene.add(mesh);

  setTile(gx, gz, {
    type,
    mesh,
    powered:       false,
    roadConnected: false,
    population:    type === 'residential' ? Math.floor(def.pop * 0.25) : 0,
  });

  playPlacement();
  updatePower();
  updateRoadConnectivity();
  updateHUD(calcStats());
}

function demolishTile(gx, gz) {
  const t = getTile(gx, gz);
  if (!t) return;
  if (t.mesh) scene.remove(t.mesh);
  delete state.tiles[tileKey(gx, gz)];
  updatePower();
  updateRoadConnectivity();
  updateHUD(calcStats());
  playRemoval();
  showAlert('🔨 Demolished', 'info');
}

// ═══════════════════════════════════════════════
//  TRAFFIC
// ═══════════════════════════════════════════════
const CAR_SPEED = 0.03;
const MAX_CARS  = 20;

function spawnCar() {
  const roads = Object.entries(state.tiles)
    .filter(([, t]) => t.type === 'road')
    .map(([k]) => k.split(',').map(Number));

  if (roads.length < 2 || state.cars.length >= MAX_CARS) return;

  const start = roads[Math.floor(Math.random() * roads.length)];
  const end   = roads[Math.floor(Math.random() * roads.length)];
  if (start[0] === end[0] && start[1] === end[1]) return;

  const palette = [0xff4444, 0x44aaff, 0xffdd44, 0xffffff, 0x44ff88, 0xff9944];
  const carMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, 0.38),
    new THREE.MeshLambertMaterial({ color: palette[Math.floor(Math.random() * palette.length)] })
  );
  const wp = worldPos(start[0], start[1]);
  carMesh.position.set(wp.x, 0.1, wp.z);
  carGroup.add(carMesh);
  state.cars.push({ mesh: carMesh, target: worldPos(end[0], end[1]) });
}

function updateCars() {
  for (let i = state.cars.length - 1; i >= 0; i--) {
    const car = state.cars[i];
    const dir = new THREE.Vector3().subVectors(car.target, car.mesh.position);
    dir.y = 0;
    if (dir.length() < 0.1) {
      carGroup.remove(car.mesh);
      state.cars.splice(i, 1);
    } else {
      dir.normalize().multiplyScalar(CAR_SPEED);
      car.mesh.position.add(dir);
      car.mesh.lookAt(car.target.x, car.mesh.position.y, car.target.z);
    }
  }
}

setInterval(spawnCar, 1800);

// ═══════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════
const raycaster  = new THREE.Raycaster();
const mouse      = new THREE.Vector2();
let selectedTool = 'residential';
let isDragging   = false;
let mouseDownPos = { x: 0, y: 0 };

function getHitCell(event) {
  mouse.x =  (event.clientX / innerWidth)  * 2 - 1;
  mouse.y = -(event.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(hitPlane);
  if (!hits.length) return null;
  return gridFromWorld(hits[0].point.x, hits[0].point.z);
}

window.addEventListener('mousemove', e => {
  const cell = getHitCell(e);
  if (cell) {
    hoverMesh.position.copy(worldPos(cell.x, cell.z)).setY(0.04);
    hoverMesh.visible = true;
    const occupied = !!getTile(cell.x, cell.z);
    hoverMesh.material.color.setHex(
      selectedTool === 'demolish' ? (occupied ? 0xe74c3c : 0x888888) :
      occupied ? 0xe67e22 : 0x00ff88
    );
    if (isDragging && selectedTool === 'road') placeTile(cell.x, cell.z, 'road');
  } else {
    hoverMesh.visible = false;
  }
});

window.addEventListener('mousedown', e => {
  if (e.target.tagName !== 'CANVAS') return;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  isDragging = true;
});

window.addEventListener('mouseup', e => {
  isDragging = false;
  if (Math.abs(e.clientX - mouseDownPos.x) > 5 || Math.abs(e.clientY - mouseDownPos.y) > 5) return;
  const cell = getHitCell(e);
  if (!cell) return;
  if (selectedTool === 'demolish') demolishTile(cell.x, cell.z);
  else placeTile(cell.x, cell.z, selectedTool);
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ═══════════════════════════════════════════════
//  LEVEL MANAGEMENT
// ═══════════════════════════════════════════════
let tickInterval = null;

function startLevel(id) {
  clearCity();
  state.currentLevel = id;
  resetState(getLevel(id));

  // Unlock this level in localStorage
  const prev = parseInt(localStorage.getItem('cb_unlocked') || '1');
  if (id > prev) localStorage.setItem('cb_unlocked', id);

  // Update tax input cap
  const cap = getLevel(id).constraints.taxCapPct;
  const taxInput = document.getElementById('tax-rate');
  taxInput.max   = cap;
  taxInput.value = state.taxRate;

  // Show level banner
  showLevelBanner(getLevel(id));

  // Restart tick
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(tick, TICK_MS);

  updateHUD(calcStats());
  showAlert(`📍 ${getLevel(id).hint}`, 'info');
}

function showLevelBanner(level) {
  const banner = document.getElementById('level-banner');
  document.getElementById('lb-num').textContent  = `Level ${level.id} of 50 · ${ERAS[level.era].name}`;
  document.getElementById('lb-name').textContent = level.name;
  document.getElementById('lb-desc').textContent = level.description;

  // Goals list
  const g = level.goals;
  const parts = [`Pop ${g.pop}`];
  if (g.jobs)  parts.push(`Jobs ${g.jobs}`);
  if (g.money) parts.push(`Cash $${g.money.toLocaleString()}`);
  parts.push(`Happiness ${g.happiness}%`);
  document.getElementById('lb-goals').textContent = 'Goals: ' + parts.join(' · ');

  // Constraints
  const c = level.constraints;
  const cons = [`Cost ×${c.costMult}`, `Tax cap ${c.taxCapPct}%`, `Power r=${c.powerRadius}`];
  if (c.budgetDrain > 0) cons.push(`Drain -$${c.budgetDrain}/yr`);
  document.getElementById('lb-constraints').textContent = cons.join(' · ');

  banner.style.display = 'flex';
  setTimeout(() => banner.style.display = 'none', 5000);
}

// Register so ui.js can call it
registerStartLevel(startLevel);

// ═══════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCars();
  renderer.render(scene, camera);
}
animate();

// ═══════════════════════════════════════════════
//  BOOT — preload assets then init UI
// ═══════════════════════════════════════════════
async function boot() {
  // Show loading indicator
  const loadEl = document.getElementById('loading');
  if (loadEl) loadEl.style.display = 'flex';

  await preloadAssets();
  await preloadAudio();

  if (loadEl) loadEl.style.display = 'none';

  initToolbar(tool => { selectedTool = tool; });
  initWelcome();
  initLevelComplete(startLevel);
  showTooltip('residential');
  updateHUD(calcStats());
}

boot();
