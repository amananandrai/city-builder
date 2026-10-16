/**
 * Central game state.
 *
 * currentLevel – active level id (1–10)
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
}
