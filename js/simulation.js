/**
 * simulation.js
 *
 * ── Service building mechanics ──────────────────────────────────────────
 *
 *  SCHOOL (radius 4)
 *    - +2 growth/yr to residential tiles in radius
 *    - Without any school: all residential growth halved
 *    - School-covered pop pays +$10 tax/person/yr
 *    - +5 happiness (capped at +15 total)
 *
 *  PARK (radius 3)
 *    - +12 happiness per park (capped at +30 total)
 *    - +20% pop capacity to residential tiles in radius
 *
 *  GOVERNMENT OFFICE (radius 5)
 *    - +8 happiness per office (capped at +24 total)
 *    - -30% unemployment happiness penalty for covered pop
 *    - Covered pop pays +15% more tax
 *    - Without any gov office when pop > 80: +10% extra unemp penalty
 *
 *  POLICE STATION (radius 5)
 *    - Generates a crimeRate per tick based on population density
 *    - Each active police station covers radius 5, reducing crime by 40%
 *    - Uncovered crime causes: -happiness (up to -20), -tax income (up to 15%)
 *    - Without any police when pop > 50: crime penalty escalates each tick
 *    - +6 happiness when active (safety feeling)
 *    - Capped at +18 happiness total from police
 *
 *  FIRE STATION (radius 5)
 *    - Each tick there is a small random chance of a fire event
 *    - Fire risk = 2% base + 1% per 100 industrial tiles (industry = fire hazard)
 *    - Each active fire station in radius reduces fire risk by 50%
 *    - If a fire occurs in an uncovered zone: that tile loses population
 *      and the player loses money (fire damage cost)
 *    - Without any fire station when pop > 40: fire events can occur
 *    - +4 happiness when active (safety feeling)
 *    - Capped at +12 happiness total from fire stations
 *
 *  Efficiency multipliers (power + road):
 *    powered + roadConnected → 1.0
 *    powered only            → 0.75
 *    roadConnected only      → 0.5
 *    neither                 → 0.25
 */
import { ZONE_DEF } from './constants.js';
import { state, getTile, tileKey } from './state.js';
import { updateHUD, showAlert } from './ui.js';
import { getLevel } from './levels.js';

// ── Power ──────────────────────────────────────────────────────────────────
export function updatePower() {
  const { powerRadius } = getLevel(state.currentLevel).constraints;
  for (const k in state.tiles) state.tiles[k].powered = false;

  for (const k in state.tiles) {
    if (state.tiles[k].type !== 'power') continue;
    const [px, pz] = k.split(',').map(Number);
    for (let dx = -powerRadius; dx <= powerRadius; dx++) {
      for (let dz = -powerRadius; dz <= powerRadius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > powerRadius) continue;
        const n = getTile(px + dx, pz + dz);
        if (n) n.powered = true;
      }
    }
  }

  for (const k in state.tiles) {
    const t = state.tiles[k];
    t.mesh?.userData.setPowered?.(t.powered);
  }
}

// ── Road connectivity ──────────────────────────────────────────────────────
export function updateRoadConnectivity() {
  for (const k in state.tiles) state.tiles[k].roadConnected = false;
  const dirs  = [[1,0],[-1,0],[0,1],[0,-1]];
  const queue = [];
  for (const k in state.tiles) {
    if (state.tiles[k].type === 'road') {
      state.tiles[k].roadConnected = true;
      queue.push(k.split(',').map(Number));
    }
  }
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of dirs) {
      const nb = getTile(x + dx, z + dz);
      if (nb && !nb.roadConnected) {
        nb.roadConnected = true;
        if (nb.type === 'road') queue.push([x + dx, z + dz]);
      }
    }
  }
}

// ── Efficiency ─────────────────────────────────────────────────────────────
export function efficiency(tile) {
  if (tile.powered && tile.roadConnected) return 1.0;
  if (tile.powered)                       return 0.75;
  if (tile.roadConnected)                 return 0.5;
  return 0.25;
}

// ── Service coverage maps ──────────────────────────────────────────────────
export function buildServiceMaps() {
  const schoolBonus  = {}; // key → extra growth/yr
  const parkCovered  = {}; // key → bool
  const govCovered   = {}; // key → bool
  const policeCovered= {}; // key → cumulative crimeReduction (0–1)
  const fireCovered  = {}; // key → cumulative fireProtection (0–1)

  for (const k in state.tiles) {
    const t   = state.tiles[k];
    const def = ZONE_DEF[t.type];
    if (!def || !t.powered || !t.roadConnected) continue;
    const r = def.serviceRadius;
    if (!r) continue;

    const [sx, sz] = k.split(',').map(Number);

    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const nk = tileKey(sx + dx, sz + dz);
        const nb = getTile(sx + dx, sz + dz);
        if (!nb) continue;

        if (t.type === 'school' && nb.type === 'residential') {
          schoolBonus[nk] = (schoolBonus[nk] || 0) + def.growthBonus;
        }
        if (t.type === 'park')       parkCovered[nk]   = true;
        if (t.type === 'government') govCovered[nk]    = true;
        if (t.type === 'police') {
          // Stack multiple police stations — each adds crimeReduction
          policeCovered[nk] = Math.min(1, (policeCovered[nk] || 0) + def.crimeReduction);
        }
        if (t.type === 'fire') {
          fireCovered[nk] = Math.min(1, (fireCovered[nk] || 0) + def.fireProtection);
        }
      }
    }
  }

  return { schoolBonus, parkCovered, govCovered, policeCovered, fireCovered };
}

// ── Population growth ──────────────────────────────────────────────────────
export function growPopulation(maps) {
  const { schoolBonus, parkCovered } = maps;
  const hasAnySchool = Object.values(state.tiles).some(
    t => t.type === 'school' && t.powered && t.roadConnected
  );

  for (const k in state.tiles) {
    const t   = state.tiles[k];
    const def = ZONE_DEF[t.type];
    if (!def || def.growth === 0) continue;

    const eff      = efficiency(t);
    const parkMult = parkCovered[k] ? 1.2 : 1.0;
    const cap      = Math.floor(def.pop * parkMult);
    const target   = Math.floor(cap * eff);

    const bonus = schoolBonus[k] || 0;
    const growthRate = bonus > 0
      ? def.growth + bonus
      : hasAnySchool ? def.growth : def.growth * 0.5;

    if (t.population < target) {
      t.population = Math.min(target, t.population + Math.ceil(growthRate * eff));
    } else if (t.population > target) {
      t.population = Math.max(target, t.population - 1);
    }
  }
}

// ── Fire events ────────────────────────────────────────────────────────────
// Returns total money lost to fires this tick and list of affected tile keys.
function processFireEvents(maps) {
  const { fireCovered } = maps;
  const tiles = Object.entries(state.tiles);

  // Count industrial tiles (fire hazard)
  const industrialCount = tiles.filter(([, t]) => t.type === 'industrial').length;
  const baseFireRisk    = 0.02 + industrialCount * 0.01; // 2% + 1% per industrial tile

  let totalDamage = 0;
  const burnedTiles = [];

  for (const [k, t] of tiles) {
    // Only residential/commercial/industrial can catch fire
    if (!['residential','commercial','industrial'].includes(t.type)) continue;
    if (!t.powered) continue; // unpowered = no electrical fire risk

    const protection = fireCovered[k] || 0;
    const risk       = baseFireRisk * (1 - protection);

    if (Math.random() < risk) {
      // Fire! Damage proportional to population/jobs
      const def    = ZONE_DEF[t.type];
      const damage = 200 + Math.floor((t.population || def.jobs) * 15);
      totalDamage += damage;

      // Population loss from fire
      if (t.type === 'residential' && t.population > 0) {
        t.population = Math.max(0, t.population - Math.ceil(t.population * 0.2));
      }

      burnedTiles.push(k);
    }
  }

  return { totalDamage, burnedTiles };
}

// ── Crime events ───────────────────────────────────────────────────────────
// Returns happiness penalty and tax income reduction from crime.
function calcCrimeImpact(maps, pop) {
  if (pop === 0) return { happinessPenalty: 0, taxReductionFrac: 0 };

  const { policeCovered } = maps;
  const tiles = Object.entries(state.tiles);

  // Base crime rate scales with population density
  const baseCrimeRate = Math.min(0.5, pop / 500); // 0–50% at 500+ pop

  // Calculate fraction of residential pop that is police-covered
  let coveredPop = 0, totalResPop = 0;
  for (const [k, t] of tiles) {
    if (t.type !== 'residential') continue;
    totalResPop += t.population;
    if (policeCovered[k]) {
      coveredPop += t.population * policeCovered[k]; // weighted by coverage strength
    }
  }

  const coveredFrac    = totalResPop > 0 ? coveredPop / totalResPop : 0;
  const effectiveCrime = baseCrimeRate * (1 - coveredFrac);

  // Crime impact: happiness penalty (0–20) and tax reduction (0–15%)
  const happinessPenalty  = effectiveCrime * 20;
  const taxReductionFrac  = effectiveCrime * 0.15;

  return { happinessPenalty, taxReductionFrac, effectiveCrime, coveredFrac };
}

// ── Stats ──────────────────────────────────────────────────────────────────
export function calcStats() {
  const maps = buildServiceMaps();
  const { schoolBonus, parkCovered, govCovered, policeCovered, fireCovered } = maps;

  let pop = 0, jobs = 0, powerUsed = 0, powerMax = 0;
  let parkHappiness = 0, govHappiness = 0, schoolHappiness = 0;
  let policeHappiness = 0, fireHappiness = 0;
  let schoolCoveredPop = 0, govCoveredPop = 0;
  let activeParkCount = 0, activeGovCount = 0, activeSchoolCount = 0;
  let activePoliceCount = 0, activeFireCount = 0;

  for (const k in state.tiles) {
    const t   = state.tiles[k];
    const def = ZONE_DEF[t.type];
    if (!def) continue;
    if (t.type === 'power') { powerMax += 50; continue; }

    const eff    = efficiency(t);
    const active = t.powered && t.roadConnected;

    if (t.type === 'residential') {
      const parkMult = parkCovered[k] ? 1.2 : 1.0;
      const cap      = Math.floor(def.pop * parkMult);
      t.population   = Math.min(t.population, Math.floor(cap * eff));
      pop += t.population;
      if (schoolBonus[k] > 0) schoolCoveredPop += t.population;
      if (govCovered[k])      govCoveredPop    += t.population;
    }

    jobs += Math.floor(def.jobs * eff);
    if (def.pop > 0 || def.jobs > 0) powerUsed += 2;

    if (active) {
      if (t.type === 'school')     { activeSchoolCount++;  schoolHappiness  += def.happinessBonus; }
      if (t.type === 'park')       { activeParkCount++;    parkHappiness    += def.happinessBonus; }
      if (t.type === 'government') { activeGovCount++;     govHappiness     += def.happinessBonus; }
      if (t.type === 'police')     { activePoliceCount++;  policeHappiness  += def.happinessBonus; }
      if (t.type === 'fire')       { activeFireCount++;    fireHappiness    += def.happinessBonus; }
    }
  }

  // ── Happiness ─────────────────────────────────────────────────────────
  const unemployed     = Math.max(0, pop - jobs);
  const govCoveredFrac = pop > 0 ? govCoveredPop / pop : 0;
  const unempPenalty   = unemployed * 0.4 * (1 - govCoveredFrac * 0.3);
  const noGovPenalty   = activeGovCount === 0 && pop > 50 ? unemployed * 0.04 : 0;
  const powerShort     = powerUsed > powerMax && powerMax > 0 ? 15 : 0;

  // Crime impact on happiness
  const crimeData = calcCrimeImpact(maps, pop);

  // No police penalty: crime impact is 50% worse
  const crimeHappinessPenalty = activePoliceCount === 0 && pop > 50
    ? crimeData.happinessPenalty * 1.5
    : crimeData.happinessPenalty;

  // Service bonuses (individually capped)
  const parkBonus    = Math.min(parkHappiness,    30);
  const govBonus     = Math.min(govHappiness,     24);
  const schoolBonus2 = Math.min(schoolHappiness,  15);
  const policeBonus  = Math.min(policeHappiness,  18);
  const fireBonus    = Math.min(fireHappiness,    12);

  const happiness = Math.max(0, Math.min(100,
    100
    - unempPenalty
    - noGovPenalty
    - powerShort
    - crimeHappinessPenalty
    + parkBonus
    + govBonus
    + schoolBonus2
    + policeBonus
    + fireBonus
  ));

  return {
    pop, jobs, powerUsed, powerMax, happiness,
    parkHappiness:   Math.min(parkHappiness, 30),
    govHappiness:    Math.min(govHappiness, 24),
    schoolHappiness: Math.min(schoolHappiness, 15),
    policeHappiness: Math.min(policeHappiness, 18),
    fireHappiness:   Math.min(fireHappiness, 12),
    activeParkCount, activeGovCount, activeSchoolCount,
    activePoliceCount, activeFireCount,
    schoolCoveredPop, govCoveredPop,
    crimeData, maps,
  };
}

// ── Check win ──────────────────────────────────────────────────────────────
export function checkWin(s) {
  const { goals } = getLevel(state.currentLevel);
  return (
    s.pop       >= goals.pop &&
    s.happiness >= goals.happiness &&
    (!goals.jobs  || s.jobs  >= goals.jobs) &&
    (!goals.money || state.money >= goals.money)
  );
}

// ── Annual tick ────────────────────────────────────────────────────────────
export function tick() {
  const maps = buildServiceMaps();
  growPopulation(maps);

  const level = getLevel(state.currentLevel);
  const s     = calcStats();

  // ── Fire events ──────────────────────────────────────────────────────
  const { totalDamage, burnedTiles } = processFireEvents(maps);
  if (totalDamage > 0) {
    state.money -= totalDamage;
    showAlert(`🔥 Fire damage! Lost $${totalDamage.toLocaleString()}. Build fire stations!`, 'warn');
  }

  // ── Income ───────────────────────────────────────────────────────────
  const baseTax        = Math.floor(s.pop * state.taxRate * 0.5 + s.jobs * state.taxRate * 0.3);
  const schoolTaxBonus = Math.floor(s.schoolCoveredPop * 10);
  const govTaxMult     = 1 + (s.govCoveredPop / Math.max(1, s.pop)) * 0.15;
  // Crime reduces tax income
  const crimeTaxMult   = 1 - (s.crimeData?.taxReductionFrac || 0);
  const income         = Math.floor((baseTax + schoolTaxBonus) * govTaxMult * crimeTaxMult);

  state.money += income - level.constraints.budgetDrain;
  state.year++;

  updateHUD(s);

  // ── Alerts ───────────────────────────────────────────────────────────
  if (s.powerUsed > s.powerMax && s.powerMax > 0)
    showAlert('⚡ Power shortage! Build more power plants.', 'warn');

  if (s.pop > s.jobs * 1.6 && s.jobs > 0)
    showAlert('💼 High unemployment — add Commercial or Industrial zones.', 'warn');

  if (state.money < 0)
    showAlert('💸 You are in debt!', 'warn');

  if (s.activeSchoolCount === 0 && s.pop > 30)
    showAlert('🏫 No schools! Residential growth is halved.', 'warn');

  if (s.activeParkCount === 0 && s.pop > 60)
    showAlert('🌳 No parks! Happiness is suffering.', 'warn');

  if (s.activeGovCount === 0 && s.pop > 80)
    showAlert('🏛 No government office! Unemployment penalty increased.', 'warn');

  if (s.activePoliceCount === 0 && s.pop > 50)
    showAlert('🚔 No police station! Crime is rising — tax income reduced.', 'warn');

  if (s.activeFireCount === 0 && s.pop > 40)
    showAlert('🚒 No fire station! Buildings are at risk of fire damage.', 'warn');

  if (s.crimeData?.effectiveCrime > 0.2)
    showAlert(`🚨 High crime rate (${Math.round(s.crimeData.effectiveCrime * 100)}%) — build more police stations.`, 'warn');

  if (level.constraints.budgetDrain > 0 && state.year % 4 === 0)
    showAlert(`🔧 Maintenance: -$${level.constraints.budgetDrain}/yr`, 'info');

  // Win
  if (!state.won && checkWin(s)) {
    state.won = true;
    import('./ui.js').then(({ showLevelComplete }) => showLevelComplete(state.currentLevel));
  }
}
