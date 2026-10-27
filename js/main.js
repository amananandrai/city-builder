import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { GRID, CELL, ZONE_DEF, TICK_MS } from './constants.js';
import { state, getTile, setTile, tileKey, resetState } from './state.js';
import { buildTileMesh, animateTile, buildScenery, disposeTile } from './meshes.js';
import { vehicle, randomTrafficKind } from './props.js';
import { grassTexture, skyTexture } from './textures.js';
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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xcfe3f0, 35, 95);

// Soft image-based lighting so metal/glass materials have something to reflect
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
camera.position.set(16, 18, 22);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xdcefff, 0x56703f, 0.35));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(14, 26, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left:-20, right:20, top:20, bottom:-20, near:1, far:80 });
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 3;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2.15;

// ── Static scene objects ──
const outerTex = grassTexture().clone();
outerTex.repeat.set(70, 70);
outerTex.needsUpdate = true;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({ map: outerTex, color: 0xb9c9a0, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// Buildable area: slightly brighter grass with a stone border
const buildTex = grassTexture().clone();
buildTex.repeat.set(GRID / 3, GRID / 3);
buildTex.needsUpdate = true;
const buildArea = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID * CELL, GRID * CELL),
  new THREE.MeshStandardMaterial({ map: buildTex, roughness: 1 })
);
buildArea.rotation.x = -Math.PI / 2;
buildArea.receiveShadow = true;
scene.add(buildArea);
{
  const half = GRID * CELL / 2, t = 0.25;
  const stone = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.9 });
  for (const [w, d, x, z] of [[GRID * CELL + t * 2, t, 0, half + t / 2], [GRID * CELL + t * 2, t, 0, -half - t / 2],
                              [t, GRID * CELL, half + t / 2, 0], [t, GRID * CELL, -half - t / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), stone);
    b.position.set(x, 0.03, z);
    b.receiveShadow = true;
    scene.add(b);
  }
}
scene.add(buildScenery(GRID * CELL / 2));

const gridHelper = new THREE.GridHelper(GRID * CELL, GRID, 0xffffff, 0xffffff);
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.12;
gridHelper.material.depthWrite = false;
gridHelper.position.y = 0.005;
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
  new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.45, depthWrite: false })
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
function removeMesh(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  disposeTile(mesh);
}

function clearCity() {
  for (const k in state.tiles) removeMesh(state.tiles[k].mesh);
  // Remove all cars
  state.cars.forEach(c => carGroup.remove(c.mesh));
}

// ═══════════════════════════════════════════════
//  TILE PLACEMENT & DEMOLISH
// ═══════════════════════════════════════════════
const NEIGHBOURS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
// Building y-rotation that turns its front (+z) toward each road direction
const FACING = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

function roadMask(gx, gz) {
  const mask = {};
  for (const [d, [dx, dz]] of Object.entries(NEIGHBOURS)) mask[d] = getTile(gx + dx, gz + dz)?.type === 'road';
  return mask;
}

function facingFor(gx, gz) {
  const mask = roadMask(gx, gz);
  // Prefer roads toward the default camera (south/east) when several touch
  for (const d of ['s', 'e', 'w', 'n']) if (mask[d]) return FACING[d];
  return 0;
}

const tileSeed = (gx, gz) => gx * 73856093 ^ gz * 19349663;

/** Rebuild a road tile so its markings/sidewalks match its neighbours. */
function refreshRoad(gx, gz) {
  const t = getTile(gx, gz);
  if (t?.type !== 'road') return;
  removeMesh(t.mesh);
  t.mesh = buildTileMesh('road', { mask: roadMask(gx, gz), seed: tileSeed(gx, gz) });
  t.mesh.position.copy(worldPos(gx, gz));
  scene.add(t.mesh);
}

function refreshRoadsAround(gx, gz) {
  for (const [dx, dz] of Object.values(NEIGHBOURS)) refreshRoad(gx + dx, gz + dz);
}

/** quiet: skip the "occupied" alert (used while drag-painting roads). */
function placeTile(gx, gz, type, quiet = false) {
  const def  = ZONE_DEF[type];
  if (!def) return;

  // Never build over an existing tile — the player must demolish it first
  const existing = getTile(gx, gz);
  if (existing) {
    if (!quiet && existing.type !== type) {
      showAlert(`🚧 Tile occupied by ${ZONE_DEF[existing.type].label} — demolish it first`, 'warn');
    }
    return;
  }

  // Apply level cost multiplier
  const mult = getLevel(state.currentLevel).constraints.costMult;
  const cost = Math.round(def.cost * mult);

  if (state.money < cost) {
    showAlert(`💸 Need $${cost.toLocaleString()} for ${def.label}`, 'warn');
    return;
  }

  state.money -= cost;

  const mesh = buildTileMesh(type, {
    mask: roadMask(gx, gz),
    facing: facingFor(gx, gz),
    seed: tileSeed(gx, gz),
    spawn: true,
  });
  mesh.position.copy(worldPos(gx, gz));
  scene.add(mesh);

  setTile(gx, gz, {
    type,
    mesh,
    powered:       false,
    roadConnected: false,
    population:    type === 'residential' ? Math.floor(def.pop * 0.25) : 0,
  });
  if (type === 'road') refreshRoadsAround(gx, gz);

  playPlacement();
  updatePower();
  updateRoadConnectivity();
  updateHUD(calcStats());
}

function demolishTile(gx, gz) {
  const t = getTile(gx, gz);
  if (!t) return;
  removeMesh(t.mesh);
  delete state.tiles[tileKey(gx, gz)];
  if (t.type === 'road') refreshRoadsAround(gx, gz);
  updatePower();
  updateRoadConnectivity();
  updateHUD(calcStats());
  playRemoval();
  showAlert('🔨 Demolished', 'info');
}

// ═══════════════════════════════════════════════
//  TRAFFIC
// ═══════════════════════════════════════════════
const CAR_SPEED = 1.1;  // world units per second
const MAX_CARS  = 24;
const LANE      = 0.2;  // offset from road centre (drive on the right)

/** BFS over road tiles from start; returns a random path of ≥3 tiles. */
function randomRoadPath(start) {
  const key = ([x, z]) => `${x},${z}`;
  const prev = { [key(start)]: null };
  const order = [start];
  for (let i = 0; i < order.length; i++) {
    const [x, z] = order[i];
    for (const [dx, dz] of Object.values(NEIGHBOURS)) {
      const n = [x + dx, z + dz];
      if (key(n) in prev || getTile(n[0], n[1])?.type !== 'road') continue;
      prev[key(n)] = order[i];
      order.push(n);
    }
  }
  if (order.length < 3) return null;
  let node = order[2 + Math.floor(Math.random() * (order.length - 2))];
  const path = [];
  while (node) { path.unshift(node); node = prev[key(node)]; }
  return path;
}

/** Convert a tile path into lane-offset world waypoints. */
function laneWaypoints(path) {
  const pts = path.map(([x, z]) => worldPos(x, z));
  const right = (a, b) => {
    const d = new THREE.Vector3().subVectors(b, a).normalize();
    return new THREE.Vector3(-d.z, 0, d.x);
  };
  return pts.map((p, i) => {
    const rIn  = i > 0 ? right(pts[i - 1], p) : null;
    const rOut = i < pts.length - 1 ? right(p, pts[i + 1]) : null;
    let off;
    if (rIn && rOut && rIn.dot(rOut) < 0.5) off = rIn.clone().add(rOut);
    else off = (rIn ?? rOut).clone();
    return p.clone().addScaledVector(off, LANE).setY(0.02);
  });
}

function spawnCar() {
  if (state.cars.length >= MAX_CARS) return;
  const roads = Object.entries(state.tiles)
    .filter(([, t]) => t.type === 'road')
    .map(([k]) => k.split(',').map(Number));
  if (roads.length < 3) return;

  const path = randomRoadPath(roads[Math.floor(Math.random() * roads.length)]);
  if (!path) return;
  const waypoints = laneWaypoints(path);

  const carMesh = vehicle(randomTrafficKind());
  carMesh.scale.setScalar(0.85);
  carMesh.traverse(c => { if (c.isMesh) c.castShadow = true; });
  carMesh.position.copy(waypoints[0]);
  carMesh.rotation.y = Math.atan2(waypoints[1].x - waypoints[0].x, waypoints[1].z - waypoints[0].z);
  carGroup.add(carMesh);
  state.cars.push({ mesh: carMesh, waypoints, idx: 1 });
}

function updateCars(dt) {
  for (let i = state.cars.length - 1; i >= 0; i--) {
    const car = state.cars[i];
    const target = car.waypoints[car.idx];
    // Road removed under the car → retire it
    const cell = gridFromWorld(car.mesh.position.x, car.mesh.position.z);
    if (!target || !cell || getTile(cell.x, cell.z)?.type !== 'road') {
      carGroup.remove(car.mesh);
      state.cars.splice(i, 1);
      continue;
    }
    const dir = new THREE.Vector3().subVectors(target, car.mesh.position);
    dir.y = 0;
    const step = CAR_SPEED * dt;
    if (dir.length() <= step) {
      car.mesh.position.copy(target);
      car.idx++;
      if (car.idx >= car.waypoints.length) {
        carGroup.remove(car.mesh);
        state.cars.splice(i, 1);
      }
      continue;
    }
    car.mesh.position.addScaledVector(dir.normalize(), step);
    // Smoothly turn toward the next waypoint
    const want = Math.atan2(dir.x, dir.z);
    let diff = want - car.mesh.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    car.mesh.rotation.y += diff * Math.min(1, dt * 10);
  }
}

setInterval(spawnCar, 1800);

// ═══════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════
const raycaster  = new THREE.Raycaster();
const mouse      = new THREE.Vector2();
let selectedTool = 'residential';
let isDragging   = false;   // left button went down on the canvas
let mouseDownPos = { x: 0, y: 0 };
let roadStart    = null;    // cell the road drag began on
let lastRoadCell = null;    // last cell painted during a road drag

/** Paint road from the last dragged cell to `cell` with 4-connected steps, so
 *  fast mouse movement can't leave gaps between road tiles. */
function paintRoadTo(cell) {
  let { x, z } = lastRoadCell ?? roadStart ?? cell;
  placeTile(x, z, 'road', true);
  while (x !== cell.x || z !== cell.z) {
    if (Math.abs(cell.x - x) >= Math.abs(cell.z - z)) x += Math.sign(cell.x - x);
    else z += Math.sign(cell.z - z);
    placeTile(x, z, 'road', true);
  }
  lastRoadCell = cell;
}

function getHitCell(event) {
  mouse.x =  (event.clientX / innerWidth)  * 2 - 1;
  mouse.y = -(event.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(hitPlane);
  if (!hits.length) return null;
  return gridFromWorld(hits[0].point.x, hits[0].point.z);
}

window.addEventListener('pointermove', e => {
  const cell = getHitCell(e);
  if (cell) {
    hoverMesh.position.copy(worldPos(cell.x, cell.z)).setY(0.04);
    hoverMesh.visible = true;
    const occupied = !!getTile(cell.x, cell.z);
    hoverMesh.material.color.setHex(
      selectedTool === 'demolish' ? (occupied ? 0xe74c3c : 0x888888) :
      occupied ? 0xe67e22 : 0x00ff88
    );
    if (isDragging && selectedTool === 'road') paintRoadTo(cell);
  } else {
    hoverMesh.visible = false;
  }
});

// Capture phase so this runs before OrbitControls reads enableRotate
window.addEventListener('pointerdown', e => {
  if (e.target.tagName !== 'CANVAS' || e.button !== 0) return;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  isDragging = true;
  roadStart = getHitCell(e);
  lastRoadCell = null;
  // With the road tool, left-drag paints roads instead of rotating the camera
  controls.enableRotate = selectedTool !== 'road';
}, true);

window.addEventListener('pointerup', e => {
  if (!isDragging || e.button !== 0) return;
  isDragging = false;
  controls.enableRotate = true;
  if (selectedTool === 'road' && lastRoadCell) {
    // Drag-painting: finish at the release point
    const cell = getHitCell(e);
    if (cell) paintRoadTo(cell);
    return;
  }
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
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t  = clock.elapsedTime;
  controls.update();
  updateCars(dt);
  for (const k in state.tiles) {
    const m = state.tiles[k].mesh;
    if (m) animateTile(m, t);
  }
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
