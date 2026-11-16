// Headless balance bot: plays every level with a simple, sensible build
// order and reports how long each takes to win under the current rules.
//
//   node tools/balance-bot.mjs          all 50 levels
//   node tools/balance-bot.mjs 1,10,50  only those levels
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const SRC = new URL('../js/', import.meta.url).pathname;
// The simulation imports ui.js (DOM), so run a copy with a stubbed ui.js
const TMP = mkdtempSync(join(tmpdir(), 'city-balance-')) + '/';
for (const f of ['constants', 'state', 'levels', 'simulation', 'events']) writeFileSync(TMP + f + '.js', readFileSync(SRC + f + '.js', 'utf8'));
writeFileSync(TMP + 'ui.js', 'export const updateHUD=()=>{};export const showAlert=()=>{};export const showLevelComplete=()=>{};');
writeFileSync(TMP + 'package.json', '{"type":"module"}');
const S = await import(TMP + 'simulation.js');
const { state, resetState, inLand, nextLandCost } = await import(TMP + 'state.js');
const { LEVELS } = await import(TMP + 'levels.js');
const { ZONE_DEF, GRID, ECONOMY, LAND_STEP } = await import(TMP + 'constants.js');
// Overrides for experiments: BOT='{"eco":{...},"growth":6,"school":4,"money":1.5,"drain":2}'
const X = JSON.parse(process.env.BOT || '{}');
Object.assign(ECONOMY, X.eco || {});
if (X.growth) ZONE_DEF.residential.growth = X.growth;
if (X.school) ZONE_DEF.school.growthBonus = X.school;
for (const l of LEVELS) {
  if (X.money) l.startMoney = Math.round(l.startMoney * X.money);
  if (X.drain) l.constraints.budgetDrain = Math.round(l.constraints.budgetDrain * X.drain);
  if (X.minRadius) l.constraints.powerRadius = Math.max(X.minRadius, l.constraints.powerRadius);
}

const key = (x, z) => `${x},${z}`;
const isRoadRow = z => z % 3 === 1;

function put(x, z, type) {
  state.tiles[key(x, z)] = { type, powered: false, roadConnected: false, population: type === 'residential' ? 3 : 0 };
}

/** Lots in build order: compact blocks spreading out from the centre. */
function lotOrder() {
  const lots = [];
  for (let z = 0; z < GRID; z++) if (!isRoadRow(z)) for (let x = 0; x < GRID; x++) lots.push([x, z]);
  const c = (GRID - 1) / 2;
  return lots.sort((a, b) => Math.max(Math.abs(a[0] - c), Math.abs(a[1] - c)) - Math.max(Math.abs(b[0] - c), Math.abs(b[1] - c)));
}

function playLevel(level, { taxRate, maxYears = 80, verbose = false } = {}) {
  resetState(level);
  state.currentLevel = level.id;
  state.running = true;
  state.taxRate = Math.min(taxRate ?? 8, level.constraints.taxCapPct);
  const { goals, constraints } = level;
  const cost = t => Math.round(ZONE_DEF[t].cost * constraints.costMult);
  const lots = lotOrder();
  let li = 0, landBought = 0;
  const pr = constraints.powerRadius;
  const poweredAt = (x, z) => Object.entries(state.tiles).some(([k, t]) => {
    if (t.type !== 'power') return false;
    const [px, pz] = k.split(',').map(Number);
    return Math.abs(px - x) + Math.abs(pz - z) <= pr;
  });
  const count = type => Object.values(state.tiles).filter(t => t.type === type).length;
  const near = (x, z, type, r) => Object.entries(state.tiles).some(([k, t]) => {
    if (t.type !== type) return false;
    const [px, pz] = k.split(',').map(Number);
    return Math.abs(px - x) <= r && Math.abs(pz - z) <= r;
  });

  /** What a sensible player would build on this lot next. */
  function choose(x, z, s) {
    if (!poweredAt(x, z)) return 'power';
    const homes = count('residential');
    const capPop = homes * 16;
    const jobsCap = count('industrial') * 35 + count('commercial') * 20 + 20;
    if (homes >= 2 && jobsCap < capPop * 0.95) return homes > 10 ? 'industrial' : 'commercial';
    if (homes >= 4 && !near(x, z, 'school', 3)) return 'school';
    if (homes >= 6 && !near(x, z, 'fire', 4)) return 'fire';
    if (homes >= 8 && !near(x, z, 'police', 4)) return 'police';
    if (homes >= 8 && !near(x, z, 'park', 2) && count('park') < Math.max(3, homes / 10)) return 'park';
    if (homes >= 12 && count('government') < 3 && !near(x, z, 'government', 6)) return 'government';
    return 'residential';
  }

  const months = maxYears * 12;
  for (let m = 0; m < months; m++) {
    const s = S.calcStats();
    const homes = count('residential');
    const enoughHomes = homes * 15 >= goals.pop * 1.08;
    const enoughJobs = s.jobs >= (goals.jobs || 0) && (s.happiness >= goals.happiness || s.jobs >= s.pop * 0.95);
    // Build while there is cash, keeping a little back for fires
    let guard = 0;
    while (li < lots.length && guard++ < 40) {
      if (enoughHomes && enoughJobs && s.happiness >= goals.happiness) break;
      const [x, z] = lots[li];
      // Road for this lot's street first
      const rz = isRoadRow(z - 1) ? z - 1 : z + 1;
      const needRoad = !state.tiles[key(x, rz)];
      // Out of owned land: buy the next ring when it is affordable
      if (!inLand(x, z) || !inLand(x, rz)) {
        const landCost = nextLandCost(constraints.costMult);
        if (landCost === null || state.money - landCost < 300) break;
        state.money -= landCost; state.land += LAND_STEP; landBought++;
        continue;
      }
      let type = choose(x, z, s);
      if (enoughHomes && type === 'residential') type = enoughJobs ? 'park' : 'industrial';
      const total = cost(type) + (needRoad ? cost('road') : 0);
      if (state.money - total < 300) break;
      if (needRoad) { put(x, rz, 'road'); state.money -= cost('road'); }
      put(x, z, type); state.money -= cost(type);
      li++;
      S.updatePower(); S.updateRoadConnectivity();
    }
    S.tick();
    if (state.won || S.checkWin(S.calcStats())) {
      const f = S.calcStats();
      return { won: true, months: m + 1, pop: f.pop, happy: Math.round(f.happiness), jobs: f.jobs, money: state.money, tiles: li, land: state.land, landBought };
    }
  }
  const f = S.calcStats();
  return { won: false, months, pop: f.pop, happy: Math.round(f.happiness), jobs: f.jobs, money: state.money, tiles: li, land: state.land, landBought,
    income: S.yearlyIncome(f) - S.yearlyUpkeep(f) };
}

const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
const rows = [];
for (const level of LEVELS) {
  if (only && !only.includes(level.id)) continue;
  // Try a few tax rates and keep the fastest win, as a player would settle on one
  let best = null;
  for (const rate of [...new Set([level.constraints.taxCapPct, 12, 10, 8, 6].filter(r => r <= level.constraints.taxCapPct))]) {
    const r = playLevel(level, { taxRate: rate });
    r.rate = rate;
    if (!best || (r.won && !best.won) || (r.won === best.won && r.months < best.months)) best = r;
  }
  rows.push({ id: level.id, ...best });
  const g = level.goals;
  console.log(`L${String(level.id).padStart(2)} ${best.won ? 'WIN ' : 'FAIL'} ${(best.months / 12).toFixed(1).padStart(5)}y tax${String(best.rate).padStart(3)}  pop ${best.pop}/${g.pop} happy ${best.happy}/${g.happiness} jobs ${best.jobs}/${g.jobs ?? '-'} $${best.money}/${g.money ?? '-'} lots ${best.tiles} land ${best.land} (+${best.landBought} rings)${best.won ? '' : ' net/yr ' + best.income}`);
}
