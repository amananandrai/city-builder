# City Builder

A 3D city-builder campaign that runs in the browser. Zone land, build roads, power the city, and grow the population across **50 levels in 5 eras**.

New players get a short step-by-step guide, a briefing before each level, an objectives panel with progress bars, and an advisor that always suggests the next step (with a guided walkthrough for the first build).

**▶ Play it live:** https://city-builder-omega.vercel.app/

---

## Features

- **50-level campaign** across five eras: Pioneer, Expansion, Industrial, Metropolis and Utopia. Later eras raise build costs, shrink power range, lower the tax cap and add yearly upkeep.
- **City simulation:** residents move in each year, taxes come in and upkeep goes out. You also manage jobs vs. population, happiness, crime and random fires.
- **Power and roads:** buildings run at full output only when they're powered *and* touch a road (100% with both, 75% power only, 50% road only, 25% neither).
- **Zones and services:** Residential, Commercial, Industrial, Power Plant, School, Park, Government Office, Police Station and Fire Station. Each service covers a radius, which is highlighted while you place it.
- **Advisor and objectives:** a live panel shows goal progress and the single most useful next step.
- **Living world:** a day/night cycle, seasons, rain and snow, cars and pedestrians, and placement and ambience sounds.
- **Cosmetic building styles:** houses or apartments, shops, mid-rise or office towers, factories, warehouses or refineries.
- **Saved progress:** unlocked levels are stored in your browser's `localStorage`.

## How to play

1. **Power first.** Place a Power Plant. Its range shows in yellow before you place it.
2. **Draw roads.** Pick the Road tool and click-and-drag. Roads join up automatically.
3. **Zone.** Residential holds up to 15 residents, Commercial gives 20 jobs and Industrial gives 35. Keep jobs close to population.
4. **Add services.** Schools speed up growth, parks raise happiness and capacity, police cut crime, and fire stations prevent costly fires.
5. **Manage time and money.** Set the tax rate in the toolbar, and use ⏸ / ▶ / ⏩ (or **Space** to pause) to control speed.

Meet every goal in the Objectives panel at the same time to complete a level.

## Tech stack

- [Three.js](https://threejs.org/) r160, loaded from a CDN via an import map, with no build step
- Plain JavaScript ES modules, HTML and CSS
- Buildings are mostly modelled procedurally in code. Extra residential variants, roads and scenery use [Kenney](https://kenney.nl/) CC0 GLB models.
- Deployed on [Vercel](https://vercel.com/) as a static site

## Run locally

The game uses ES modules and loads 3D models, so it has to be served over HTTP. Opening `index.html` straight from disk won't work.

```bash
git clone https://github.com/amananandrai/city-builder.git
cd city-builder
npm start          # runs `npx serve . --listen 3000`
```

Then open http://localhost:3000.

## Project structure

```
index.html          UI shell: guide, level select, briefing, HUD
style.css
js/
  main.js           scene setup, input, render loop
  simulation.js     economy, growth, happiness, crime and fire logic
  levels.js         the 50 levels and their goals and constraints
  constants.js      grid size, zone definitions, economy tuning
  advisor.js        objectives and "next step" guidance
  meshes.js, props.js, textures.js, assets.js   building and scenery models
  atmosphere.js, weather.js, effects.js         day/night, seasons, rain/snow, FX
  ui.js, state.js, events.js
assets/models, assets/sounds
tools/balance-bot.mjs   headless bot that plays every level to check difficulty
```

### Balance bot

`tools/balance-bot.mjs` plays each level with a simple build order and reports how long it takes to win. Re-run it after changing the economy, growth rates or level table:

```bash
node tools/balance-bot.mjs          # all 50 levels
node tools/balance-bot.mjs 1,10,50  # specific levels
```

## License

[MIT](LICENSE) © 2026 Aman Anand Rai. The GLB models in `assets/models` are by Kenney (CC0).
