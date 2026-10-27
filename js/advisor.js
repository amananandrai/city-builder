/**
 * advisor.js — turns the live city state into player guidance:
 *   objectives(s) – goal progress rows for the objectives panel
 *   advise(s)     – the single most useful next step, with the tool to use
 *
 * Pure logic (no DOM) so it stays easy to reason about and test.
 */
import { state } from './state.js';
import { getLevel } from './levels.js';
import { yearlyIncome, yearlyUpkeep } from './simulation.js';

const ZONES = ['residential', 'commercial', 'industrial', 'school', 'park', 'government', 'police', 'fire'];

/** Goal rows: { icon, label, value, target, met, fmt } */
export function objectives(s) {
  const { goals } = getLevel(state.currentLevel);
  const rows = [
    { key: 'pop', icon: '👥', label: 'Population', value: s.pop, target: goals.pop },
  ];
  if (goals.jobs)  rows.push({ key: 'jobs', icon: '💼', label: 'Jobs', value: s.jobs, target: goals.jobs });
  rows.push({ key: 'happiness', icon: '😊', label: 'Happiness', value: Math.round(s.happiness), target: goals.happiness, suffix: '%' });
  if (goals.money) rows.push({ key: 'money', icon: '💰', label: 'Cash reserve', value: state.money, target: goals.money, prefix: '$' });
  for (const r of rows) r.met = r.value >= r.target;
  return rows;
}

function count(pred) {
  let n = 0;
  for (const k in state.tiles) if (pred(state.tiles[k])) n++;
  return n;
}

/**
 * Next-step advice. Returns { icon, title, text, tool?, step?, tone }.
 * tone: 'tip' (neutral), 'warn' (something is broken), 'good' (on track)
 * `step` is set for the first-build walkthrough (1–4) so the UI can number it.
 */
export function advise(s) {
  const level = getLevel(state.currentLevel);
  const { goals } = level;
  const plants  = count(t => t.type === 'power');
  const roads   = count(t => t.type === 'road');
  const homes   = count(t => t.type === 'residential');
  const workIn  = count(t => t.type === 'commercial' || t.type === 'industrial');
  const zones   = count(t => ZONES.includes(t.type));
  const noRoad  = count(t => ZONES.includes(t.type) && !t.roadConnected);
  const noPower = count(t => ZONES.includes(t.type) && !t.powered);

  // ── First-build walkthrough ──────────────────────────────────────────
  if (plants === 0) return {
    step: 1, icon: '⚡', tool: 'power', tone: 'tip', title: 'Build a Power Plant',
    text: `Everything needs electricity. Pick ⚡ Power Plant and click a tile near the middle of the map — it powers tiles up to ${level.constraints.powerRadius} steps away.`,
  };
  if (roads === 0) return {
    step: 2, icon: '🛣', tool: 'road', tone: 'tip', title: 'Draw a road',
    text: 'Buildings only work when they touch a road. Pick 🛣 Road and click-and-drag to draw a street next to your power plant.',
  };
  if (homes === 0) return {
    step: 3, icon: '🏠', tool: 'residential', tone: 'tip', title: 'Zone some homes',
    text: 'Pick 🏠 Residential and click tiles beside the road, inside the yellow power range. Each home grows to 15 residents.',
  };
  if (workIn === 0 && s.pop > 0) return {
    step: 4, icon: '🏪', tool: 'commercial', tone: 'tip', title: 'Give residents jobs',
    text: 'Residents need work or happiness drops. Add 🏪 Commercial or 🏭 Industrial zones along the road.',
  };

  // ── Something is broken ──────────────────────────────────────────────
  if (noRoad > 0) return {
    icon: '🛣', tool: 'road', tone: 'warn', title: `${noRoad} building${noRoad > 1 ? 's' : ''} without road access`,
    text: 'Buildings that don\'t touch a road run at half output. Connect them with the Road tool — look for tiles without a street beside them.',
  };
  if (noPower > 0) return {
    icon: '⚡', tool: 'power', tone: 'warn', title: `${noPower} building${noPower > 1 ? 's' : ''} without power`,
    text: 'Buildings with a red ⚡ badge are outside every plant\'s range. Build another Power Plant near them.',
  };
  if (s.powerUsed > s.powerMax) return {
    icon: '⚡', tool: 'power', tone: 'warn', title: 'Power shortage',
    text: `Demand is ${s.powerUsed} but plants supply ${s.powerMax}. Each plant supplies 50 (25 buildings). Build another plant — shortages cost 15 happiness.`,
  };
  if (state.money < 0) {
    const net = yearlyIncome(s) - yearlyUpkeep(s);
    return {
      icon: '💸', tone: 'warn', title: 'You are in debt',
      text: net > 0
        ? `You earn about $${net.toLocaleString()} a year — wait for the debt to clear before building more. Raising the tax rate speeds this up.`
        : 'You are losing money every year. Raise the tax rate, and grow population (more taxpayers) once you can afford it.',
    };
  }
  if (s.pop > 20 && s.jobs < s.pop * 0.8) return {
    icon: '💼', tool: s.pop > 150 ? 'industrial' : 'commercial', tone: 'warn', title: 'Not enough jobs',
    text: `${(s.pop - s.jobs).toLocaleString()} residents are unemployed, which drags happiness down. Commercial adds 20 jobs, Industrial 35.`,
  };

  // ── Services, in the order they start to matter ──────────────────────
  if (s.activeSchoolCount === 0 && s.pop >= 20) return {
    icon: '🏫', tool: 'school', tone: 'tip', title: 'Build a school',
    text: 'Without a school, every home grows at half speed. Homes within 4 tiles of a school grow even faster and pay extra tax.',
  };
  if (s.activeFireCount === 0 && s.pop > 30) return {
    icon: '🚒', tool: 'fire', tone: 'tip', title: 'Protect against fires',
    text: 'Once your city passes 40 residents, buildings can catch fire and cost you money. A Fire Station protects everything within 5 tiles.',
  };
  if (s.activePoliceCount === 0 && s.pop > 40) return {
    icon: '🚔', tool: 'police', tone: 'tip', title: 'Build a police station',
    text: 'Crime grows with population and cuts happiness and tax income. Police cover 5 tiles in every direction.',
  };

  // ── Goals ────────────────────────────────────────────────────────────
  if (s.happiness < goals.happiness) {
    if (s.activeParkCount * 12 < 30) return {
      icon: '🌳', tool: 'park', tone: 'tip', title: 'Raise happiness',
      text: `Happiness is ${Math.round(s.happiness)}%, the goal is ${goals.happiness}%. Each Park adds +12 (up to +30) and lets nearby homes hold 20% more people.`,
    };
    if (s.activeGovCount * 8 < 24) return {
      icon: '🏛', tool: 'government', tone: 'tip', title: 'Raise happiness',
      text: `Happiness is ${Math.round(s.happiness)}%, the goal is ${goals.happiness}%. A Government Office adds +8 and softens the unemployment penalty.`,
    };
    return {
      icon: '💼', tool: 'commercial', tone: 'tip', title: 'Raise happiness',
      text: 'Service bonuses are maxed. Cut unemployment (more jobs) and add police coverage to reduce crime.',
    };
  }
  if (s.pop < goals.pop) {
    // Rough housing capacity: 15 per home (+20% near parks)
    const capacity = homes * 15;
    return capacity < goals.pop ? {
      icon: '🏠', tool: 'residential', tone: 'tip', title: 'Zone more homes',
      text: `Your ${homes} home${homes === 1 ? '' : 's'} can hold about ${capacity} people, but the goal is ${goals.pop.toLocaleString()}. Add Residential zones beside powered roads — near a school and park for faster growth.`,
    } : {
      icon: '⏳', tone: 'good', title: 'Population is growing',
      text: `Residents move in each year (${s.pop}/${goals.pop.toLocaleString()}). ${s.activeSchoolCount ? 'Schools nearby speed this up.' : 'A school would double the speed.'} Use ⏩ to fast-forward.`,
    };
  }
  if (goals.jobs && s.jobs < goals.jobs) return {
    icon: '🏭', tool: 'industrial', tone: 'tip', title: 'Create more jobs',
    text: `You have ${s.jobs} of ${goals.jobs} jobs. Industrial zones give the most (35 each).`,
  };
  if (goals.money && state.money < goals.money) return {
    icon: '💰', tone: 'good', title: 'Build up your cash reserve',
    text: `Hold off building and let taxes pile up: $${state.money.toLocaleString()} of $${goals.money.toLocaleString()}. Net income is about $${(yearlyIncome(s) - yearlyUpkeep(s)).toLocaleString()}/yr.`,
  };
  return {
    icon: '🎯', tone: 'good', title: 'All goals met!',
    text: 'Hold steady — the level completes at the end of this year.',
  };
}
