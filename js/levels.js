/**
 * levels.js — 50 levels across 5 themed eras.
 *
 * Era 1  Lv  1–10  "Pioneer"      — learning the basics, gentle ramp
 * Era 2  Lv 11–20  "Expansion"    — larger goals, tighter budgets
 * Era 3  Lv 21–30  "Industrial"   — heavy drain, shrinking power radius
 * Era 4  Lv 31–40  "Metropolis"   — extreme scale, cash reserves required
 * Era 5  Lv 41–50  "Utopia"       — near-impossible constraints, max difficulty
 *
 * Fields per level:
 *   id, name, description, era, startMoney
 *   goals:       { pop, happiness, jobs?, money? }
 *   constraints: { costMult, taxCapPct, powerRadius, budgetDrain }
 *   hint
 */

// Helper to build a level object cleanly
function lv(id, name, description, era, startMoney, goals, constraints, hint) {
  return { id, name, description, era, startMoney, goals, constraints, hint };
}

export const LEVELS = [
  // ══════════════════════════════════════════════
  //  ERA 1 — PIONEER  (Lv 1–10)
  // ══════════════════════════════════════════════
  lv(1,  'Empty Lot',       'A blank grid. Get your first residents settled.',
     1, 12000, { pop:30,  happiness:50 },
     { costMult:1.0, taxCapPct:20, powerRadius:6, budgetDrain:0 },
     'Place a Power Plant, draw roads, then zone Residential.'),

  lv(2,  'First Neighbours','Grow beyond a handful of houses.',
     1, 11000, { pop:60,  happiness:50 },
     { costMult:1.0, taxCapPct:20, powerRadius:6, budgetDrain:0 },
     'More residential zones = faster population growth.'),

  lv(3,  'Small Town',      'Residents need jobs. Add some commerce.',
     1, 10000, { pop:100, happiness:52, jobs:40 },
     { costMult:1.0, taxCapPct:20, powerRadius:6, budgetDrain:0 },
     'Commercial zones near roads create jobs quickly.'),

  lv(4,  'Main Street',     'A proper town needs a school and a park.',
     1, 10000, { pop:140, happiness:55, jobs:60 },
     { costMult:1.05, taxCapPct:20, powerRadius:6, budgetDrain:0 },
     'Schools boost residential growth. Parks raise happiness.'),

  lv(5,  'Growing Pains',   'Expansion costs more. Budget wisely.',
     1, 9500,  { pop:180, happiness:55, jobs:80 },
     { costMult:1.1, taxCapPct:18, powerRadius:6, budgetDrain:0 },
     'Costs are 10% higher. Prioritise roads before zoning.'),

  lv(6,  'Industrial Dawn', 'Heavy industry drives growth but needs power.',
     1, 9000,  { pop:220, happiness:55, jobs:120 },
     { costMult:1.15, taxCapPct:18, powerRadius:6, budgetDrain:50 },
     'Industrial zones provide the most jobs per tile.'),

  lv(7,  'Tax Squeeze',     'Citizens resist high taxes. Keep them happy.',
     1, 9000,  { pop:270, happiness:58, jobs:150 },
     { costMult:1.15, taxCapPct:14, powerRadius:6, budgetDrain:80 },
     'Tax cap is 14%. Grow population to compensate.'),

  lv(8,  'Civic Pride',     'A government office boosts morale.',
     1, 8500,  { pop:320, happiness:60, jobs:180 },
     { costMult:1.2, taxCapPct:14, powerRadius:5, budgetDrain:100 },
     'Government offices add jobs and happiness. Build one early.'),

  lv(9,  'Power Crunch',    'Power plants cover less ground now.',
     1, 8500,  { pop:380, happiness:60, jobs:220 },
     { costMult:1.2, taxCapPct:14, powerRadius:5, budgetDrain:150 },
     'Power radius is 5. Spread plants across the grid.'),

  lv(10, 'Pioneer\'s Peak', 'Complete the pioneer era with a thriving city.',
     1, 8000,  { pop:450, happiness:62, jobs:260, money:4000 },
     { costMult:1.25, taxCapPct:12, powerRadius:5, budgetDrain:200 },
     'Keep $4,000 in reserve while hitting all goals.'),

  // ══════════════════════════════════════════════
  //  ERA 2 — EXPANSION  (Lv 11–20)
  // ══════════════════════════════════════════════
  lv(11, 'New Horizons',    'The city expands. More zones, more complexity.',
     2, 9000,  { pop:500, happiness:60, jobs:300 },
     { costMult:1.25, taxCapPct:12, powerRadius:5, budgetDrain:220 },
     'Plan your grid layout before spending — space is precious.'),

  lv(12, 'School District', 'Education drives faster population growth.',
     2, 8500,  { pop:560, happiness:62, jobs:330 },
     { costMult:1.3, taxCapPct:12, powerRadius:5, budgetDrain:250 },
     'Place schools near clusters of residential zones for max effect.'),

  lv(13, 'Green City',      'Parks everywhere. Happiness is the priority.',
     2, 8500,  { pop:600, happiness:65, jobs:350 },
     { costMult:1.3, taxCapPct:12, powerRadius:5, budgetDrain:280 },
     'Parks cap happiness bonus at +30. Spread them out.'),

  lv(14, 'Commerce Boom',   'Commercial zones are your main income source.',
     2, 8000,  { pop:650, happiness:63, jobs:400 },
     { costMult:1.35, taxCapPct:12, powerRadius:5, budgetDrain:300 },
     'More commercial = more jobs and more tax income.'),

  lv(15, 'Mid-City Blues',  'Maintenance costs bite. Stay in the black.',
     2, 8000,  { pop:700, happiness:63, jobs:430, money:3000 },
     { costMult:1.35, taxCapPct:10, powerRadius:5, budgetDrain:350 },
     'Tax cap drops to 10%. You need volume, not rate.'),

  lv(16, 'Power Grid',      'Multiple power plants required.',
     2, 7500,  { pop:760, happiness:63, jobs:460 },
     { costMult:1.4, taxCapPct:10, powerRadius:4, budgetDrain:380 },
     'Power radius is 4. You\'ll need at least 4 plants.'),

  lv(17, 'Urban Sprawl',    'The city spreads to every corner.',
     2, 7500,  { pop:820, happiness:63, jobs:500 },
     { costMult:1.4, taxCapPct:10, powerRadius:4, budgetDrain:420 },
     'Fill the grid efficiently — no wasted tiles.'),

  lv(18, 'Civic Expansion', 'Government offices in every district.',
     2, 7000,  { pop:880, happiness:65, jobs:540 },
     { costMult:1.45, taxCapPct:10, powerRadius:4, budgetDrain:460 },
     'Government offices provide 15 jobs each — great value.'),

  lv(19, 'Recession Watch', 'Economic pressure. Keep reserves high.',
     2, 7000,  { pop:940, happiness:65, jobs:580, money:5000 },
     { costMult:1.45, taxCapPct:10, powerRadius:4, budgetDrain:500 },
     'You need $5,000 in reserve. Don\'t overspend on buildings.'),

  lv(20, 'Expansion\'s End','Complete the expansion era.',
     2, 7000,  { pop:1000, happiness:65, jobs:620, money:5000 },
     { costMult:1.5, taxCapPct:10, powerRadius:4, budgetDrain:550 },
     'Hit 1,000 population for the first time. Plan carefully.'),

  // ══════════════════════════════════════════════
  //  ERA 3 — INDUSTRIAL  (Lv 21–30)
  // ══════════════════════════════════════════════
  lv(21, 'Factory District','Industry dominates. Pollution hits happiness.',
     3, 7000,  { pop:1060, happiness:63, jobs:680 },
     { costMult:1.5, taxCapPct:10, powerRadius:4, budgetDrain:600 },
     'Balance industrial zones with parks to offset happiness loss.'),

  lv(22, 'Smoke & Steel',   'Heavy industry, tight budgets.',
     3, 6500,  { pop:1120, happiness:63, jobs:740 },
     { costMult:1.55, taxCapPct:10, powerRadius:4, budgetDrain:650 },
     'Industrial zones give 35 jobs — cluster them near power.'),

  lv(23, 'Worker\'s City',  'Jobs for everyone. Unemployment must stay low.',
     3, 6500,  { pop:1180, happiness:64, jobs:800 },
     { costMult:1.55, taxCapPct:9, powerRadius:4, budgetDrain:700 },
     'Keep jobs ≥ population to avoid happiness penalty.'),

  lv(24, 'Power Shortage',  'Aging grid. Power radius shrinks further.',
     3, 6500,  { pop:1240, happiness:64, jobs:840 },
     { costMult:1.6, taxCapPct:9, powerRadius:3, budgetDrain:750 },
     'Power radius is now 3. You need many more plants.'),

  lv(25, 'Halfway There',   'The midpoint. A true test of planning.',
     3, 6000,  { pop:1300, happiness:65, jobs:880, money:6000 },
     { costMult:1.6, taxCapPct:9, powerRadius:3, budgetDrain:800 },
     'Level 25 milestone. Keep $6,000 reserve while growing.'),

  lv(26, 'Dense Zoning',    'Every tile must earn its place.',
     3, 6000,  { pop:1380, happiness:65, jobs:930 },
     { costMult:1.65, taxCapPct:9, powerRadius:3, budgetDrain:850 },
     'Mix zone types in tight clusters for maximum efficiency.'),

  lv(27, 'Tax Revolt',      'Citizens demand lower taxes.',
     3, 6000,  { pop:1460, happiness:66, jobs:980 },
     { costMult:1.65, taxCapPct:8, powerRadius:3, budgetDrain:900 },
     'Tax cap is 8%. You need a very large population to stay solvent.'),

  lv(28, 'Infrastructure',  'Maintenance costs are severe.',
     3, 5500,  { pop:1540, happiness:66, jobs:1030 },
     { costMult:1.7, taxCapPct:8, powerRadius:3, budgetDrain:1000 },
     'Drain is $1,000/tick. Build commercial zones for income fast.'),

  lv(29, 'City of Schools', 'Education is the key to faster growth.',
     3, 5500,  { pop:1620, happiness:67, jobs:1080 },
     { costMult:1.7, taxCapPct:8, powerRadius:3, budgetDrain:1050 },
     'Schools near residential clusters accelerate growth significantly.'),

  lv(30, 'Industrial Peak', 'Complete the industrial era.',
     3, 5500,  { pop:1700, happiness:67, jobs:1130, money:7000 },
     { costMult:1.75, taxCapPct:8, powerRadius:3, budgetDrain:1100 },
     'Hit 1,700 population. Keep $7,000 reserve. Plan every tile.'),

  // ══════════════════════════════════════════════
  //  ERA 4 — METROPOLIS  (Lv 31–40)
  // ══════════════════════════════════════════════
  lv(31, 'Megacity Rising', 'The city becomes a true metropolis.',
     4, 5500,  { pop:1800, happiness:67, jobs:1200 },
     { costMult:1.75, taxCapPct:8, powerRadius:3, budgetDrain:1150 },
     'You\'re in the endgame. Every zone placement matters.'),

  lv(32, 'Park Network',    'A city-wide park system boosts morale.',
     4, 5000,  { pop:1900, happiness:68, jobs:1260 },
     { costMult:1.8, taxCapPct:8, powerRadius:3, budgetDrain:1200 },
     'Parks cap at +30 happiness. Spread them across districts.'),

  lv(33, 'Civic Centre',    'Government offices anchor each district.',
     4, 5000,  { pop:2000, happiness:68, jobs:1320 },
     { costMult:1.8, taxCapPct:8, powerRadius:3, budgetDrain:1250 },
     'Government offices: 15 jobs + 8 happiness. Excellent ROI.'),

  lv(34, 'Power Web',       'A dense power grid is essential.',
     4, 5000,  { pop:2100, happiness:68, jobs:1380 },
     { costMult:1.85, taxCapPct:7, powerRadius:3, budgetDrain:1300 },
     'Tax cap drops to 7%. You need 2,100 residents to compensate.'),

  lv(35, 'Deep Recession',  'Economic crisis. Survive the drain.',
     4, 4500,  { pop:2200, happiness:68, jobs:1440, money:8000 },
     { costMult:1.85, taxCapPct:7, powerRadius:3, budgetDrain:1400 },
     'Drain is $1,400/tick. Build income zones before anything else.'),

  lv(36, 'Urban Density',   'Pack the grid as tightly as possible.',
     4, 4500,  { pop:2320, happiness:69, jobs:1510 },
     { costMult:1.9, taxCapPct:7, powerRadius:3, budgetDrain:1450 },
     'Residential + school clusters are the most efficient combo.'),

  lv(37, 'Job Market',      'Employment must keep pace with population.',
     4, 4500,  { pop:2440, happiness:69, jobs:1600 },
     { costMult:1.9, taxCapPct:7, powerRadius:3, budgetDrain:1500 },
     'Industrial zones give the most jobs. Use them heavily.'),

  lv(38, 'Happiness Drive', 'Citizens demand quality of life.',
     4, 4000,  { pop:2560, happiness:70, jobs:1680 },
     { costMult:1.95, taxCapPct:7, powerRadius:3, budgetDrain:1600 },
     'Parks + government offices are your happiness tools.'),

  lv(39, 'Budget Crisis',   'Costs are near maximum. Efficiency is everything.',
     4, 4000,  { pop:2680, happiness:70, jobs:1760, money:8000 },
     { costMult:1.95, taxCapPct:6, powerRadius:3, budgetDrain:1700 },
     'Tax cap is 6%. You need massive population to stay solvent.'),

  lv(40, 'Metropolis Peak', 'Complete the metropolis era.',
     4, 4000,  { pop:2800, happiness:70, jobs:1840, money:10000 },
     { costMult:2.0, taxCapPct:6, powerRadius:3, budgetDrain:1800 },
     'Costs are double base. Hit 2,800 pop and keep $10,000 reserve.'),

  // ══════════════════════════════════════════════
  //  ERA 5 — UTOPIA  (Lv 41–50)
  // ══════════════════════════════════════════════
  lv(41, 'Utopia Begins',   'The final era. Near-impossible constraints.',
     5, 4000,  { pop:2950, happiness:70, jobs:1940 },
     { costMult:2.0, taxCapPct:6, powerRadius:3, budgetDrain:1900 },
     'Every tile must be optimised. No room for waste.'),

  lv(42, 'Perfect Grid',    'Design the most efficient city layout.',
     5, 3500,  { pop:3100, happiness:71, jobs:2040 },
     { costMult:2.05, taxCapPct:6, powerRadius:3, budgetDrain:2000 },
     'Cluster: power plant → roads → residential + school + park.'),

  lv(43, 'Maximum Density', 'Fill every cell with purpose.',
     5, 3500,  { pop:3260, happiness:71, jobs:2150 },
     { costMult:2.05, taxCapPct:6, powerRadius:3, budgetDrain:2100 },
     'Industrial zones near power plants, residential near schools.'),

  lv(44, 'Civic Utopia',    'Government and education for all.',
     5, 3500,  { pop:3420, happiness:72, jobs:2260 },
     { costMult:2.1, taxCapPct:5, powerRadius:3, budgetDrain:2200 },
     'Tax cap is 5%. You need 3,400+ residents to break even.'),

  lv(45, 'Green Utopia',    'Parks in every district. Maximum happiness.',
     5, 3000,  { pop:3580, happiness:73, jobs:2370 },
     { costMult:2.1, taxCapPct:5, powerRadius:3, budgetDrain:2300 },
     'Happiness goal is 73%. Parks + gov offices are essential.'),

  lv(46, 'Power Mastery',   'Tiny power radius. Dense plant network.',
     5, 3000,  { pop:3740, happiness:73, jobs:2480, money:10000 },
     { costMult:2.15, taxCapPct:5, powerRadius:2, budgetDrain:2400 },
     'Power radius is 2. You need a plant every 4 tiles.'),

  lv(47, 'Economic Titan',  'Massive reserves required.',
     5, 3000,  { pop:3900, happiness:73, jobs:2600, money:12000 },
     { costMult:2.15, taxCapPct:5, powerRadius:2, budgetDrain:2500 },
     'Keep $12,000 in reserve while hitting all other goals.'),

  lv(48, 'The Final Push',  'Almost there. Push every stat to the limit.',
     5, 2500,  { pop:4100, happiness:74, jobs:2750, money:12000 },
     { costMult:2.2, taxCapPct:5, powerRadius:2, budgetDrain:2700 },
     'Costs are 2.2×. Plan every purchase before you make it.'),

  lv(49, 'Legendary City',  'One step from perfection.',
     5, 2500,  { pop:4300, happiness:75, jobs:2900, money:15000 },
     { costMult:2.2, taxCapPct:5, powerRadius:2, budgetDrain:2900 },
     'Keep $15,000 reserve. Happiness must hit 75%. Near impossible.'),

  lv(50, 'Utopia',          'The ultimate challenge. Build the perfect city.',
     5, 2000,  { pop:4500, happiness:75, jobs:3000, money:20000 },
     { costMult:2.25, taxCapPct:4, powerRadius:2, budgetDrain:3000 },
     'Tax cap 4%, power radius 2, drain $3,000/tick. Legendary.'),
];

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}

// Era metadata for display
export const ERAS = {
  1: { name:'Pioneer',    color:'#5dade2', range:'1–10'  },
  2: { name:'Expansion',  color:'#2ecc71', range:'11–20' },
  3: { name:'Industrial', color:'#e67e22', range:'21–30' },
  4: { name:'Metropolis', color:'#9b59b6', range:'31–40' },
  5: { name:'Utopia',     color:'#e74c3c', range:'41–50' },
};
