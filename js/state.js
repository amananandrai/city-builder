/**
 * Central game state.
 *
 * currentLevel – active level id (1–50)
 * running      – the level briefing was dismissed and years are ticking
 * paused/speed – player time controls (speed is 1, 2 or 3)
 * yearClock    – seconds elapsed in the current year
 * tiles        – map of "x,z" -> TileData
 *   TileData: { type, mesh, powered, roadConnected, population }
 */
export const state = {
  money:        10000,
  year:         1,
  taxRate:      8,
  currentLevel: 1,
  tiles:        {},
  cars:         [],
  won:          false,
  running:      false,
  paused:       false,
  speed:        1,
  yearClock:    0,
};

export const tileKey = (x, z) => `${x},${z}`;
export const getTile  = (x, z) => state.tiles[tileKey(x, z)];
export const setTile  = (x, z, data) => { state.tiles[tileKey(x, z)] = data; };
export const delTile  = (x, z) => { delete state.tiles[tileKey(x, z)]; };

/** Reset state for a new level, keeping currentLevel intact. */
export function resetState(level) {
  state.money   = level.startMoney;
  state.year    = 1;
  state.taxRate = Math.min(8, level.constraints.taxCapPct);
  state.tiles   = {};
  state.cars    = [];
  state.won     = false;
  state.running = false;
  state.paused  = false;
  state.yearClock = 0;
}
