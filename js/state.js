/**
 * Central game state.
 *
 * currentLevel – active level id (1–50)
 * running      – the level briefing was dismissed and years are ticking
 * paused/speed – player time controls (speed is 1, 2 or 3)
 * yearClock    – seconds elapsed in the current month
 * month        – 0–11, the simulation ticks once per month
 * dayClock     – seconds of play this level, drives the day/night cycle
 * land         – side length (cells) of the owned plot, centred on the grid
 * tiles        – map of "x,z" -> TileData
 *   TileData: { type, mesh, powered, roadConnected, population }
 */
import { GRID, LAND_STEP, LAND_COST_PER_CELL } from './constants.js';

export const state = {
  money:        10000,
  year:         1,
  month:        3,   // 0–11 (cities are founded in spring)
  monthsPlayed: 0,
  taxRate:      8,
  currentLevel: 1,
  tiles:        {},
  cars:         [],
  won:          false,
  running:      false,
  paused:       false,
  speed:        1,
  yearClock:    0,
  dayClock:     0,   // seconds of play this level (drives day/night)
  land:         24,  // side of the owned square plot, in cells
  styles:       {},  // tool -> chosen building style id (unset = automatic)
};

/** Is this cell inside the land the city owns? */
export function inLand(x, z) {
  const lo = (GRID - state.land) / 2;
  return x >= lo && z >= lo && x < lo + state.land && z < lo + state.land;
}
/** Price of the next ring of land, or null when the whole grid is owned. */
export function nextLandCost(costMult = 1) {
  if (state.land >= GRID) return null;
  const cells = (state.land + LAND_STEP) ** 2 - state.land ** 2;
  return Math.round(cells * LAND_COST_PER_CELL * costMult / 50) * 50;
}

export const tileKey = (x, z) => `${x},${z}`;
export const getTile  = (x, z) => state.tiles[tileKey(x, z)];
export const setTile  = (x, z, data) => { state.tiles[tileKey(x, z)] = data; };
export const delTile  = (x, z) => { delete state.tiles[tileKey(x, z)]; };

/** Reset state for a new level, keeping currentLevel intact. */
export function resetState(level) {
  state.money   = level.startMoney;
  state.year    = 1;
  state.month   = 3;
  state.monthsPlayed = 0;
  state.taxRate = Math.min(8, level.constraints.taxCapPct);
  state.tiles   = {};
  state.cars    = [];
  state.won     = false;
  state.running = false;
  state.paused  = false;
  state.yearClock = 0;
  state.dayClock = 0;
  state.land    = level.land;
}
