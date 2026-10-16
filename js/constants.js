// ── Grid & world constants ──
export const GRID    = 24;   // cells per side
export const CELL    = 1.2;  // world units per cell
export const TICK_MS = 5000; // ms per simulation year

// ── Zone definitions ──
// pop:            base population capacity
// jobs:           jobs provided
// cost:           base build cost (multiplied by level costMult)
// taxBase:        annual tax revenue when fully active
// growth:         population added per year (residential only)
// happinessBonus: flat happiness added per tile when active
// growthBonus:    extra growth added to nearby residential tiles (school)
// serviceRadius:  radius in which bonus applies
// crimeReduction: % crime reduction per tile in radius (police)
// fireProtection: % fire risk reduction per tile in radius (fire station)
export const ZONE_DEF = {
  residential: { color:0x4a90d9, label:'Residential',       pop:15, jobs:0,  cost:400,  taxBase:30,  growth:3, happinessBonus:0,  growthBonus:0, serviceRadius:0, crimeReduction:0,   fireProtection:0   },
  commercial:  { color:0xf39c12, label:'Commercial',         pop:0,  jobs:20, cost:600,  taxBase:80,  growth:0, happinessBonus:0,  growthBonus:0, serviceRadius:0, crimeReduction:0,   fireProtection:0   },
  industrial:  { color:0x8e44ad, label:'Industrial',         pop:0,  jobs:35, cost:700,  taxBase:120, growth:0, happinessBonus:0,  growthBonus:0, serviceRadius:0, crimeReduction:0,   fireProtection:0   },
  road:        { color:0x555555, label:'Road',               pop:0,  jobs:0,  cost:80,   taxBase:0,   growth:0, happinessBonus:0,  growthBonus:0, serviceRadius:0, crimeReduction:0,   fireProtection:0   },
  power:       { color:0xf1c40f, label:'Power Plant',        pop:0,  jobs:5,  cost:1500, taxBase:0,   growth:0, happinessBonus:0,  growthBonus:0, serviceRadius:0, crimeReduction:0,   fireProtection:0   },
  school:      { color:0x1abc9c, label:'School',             pop:0,  jobs:8,  cost:900,  taxBase:0,   growth:0, happinessBonus:5,  growthBonus:2, serviceRadius:4, crimeReduction:0,   fireProtection:0   },
  park:        { color:0x27ae60, label:'Park',               pop:0,  jobs:2,  cost:350,  taxBase:0,   growth:0, happinessBonus:12, growthBonus:0, serviceRadius:3, crimeReduction:0,   fireProtection:0   },
  government:  { color:0xc0392b, label:'Government Office',  pop:0,  jobs:15, cost:1200, taxBase:0,   growth:0, happinessBonus:8,  growthBonus:0, serviceRadius:5, crimeReduction:0,   fireProtection:0   },
  police:      { color:0x2471a3, label:'Police Station',     pop:0,  jobs:10, cost:1000, taxBase:0,   growth:0, happinessBonus:6,  growthBonus:0, serviceRadius:5, crimeReduction:0.4, fireProtection:0   },
  fire:        { color:0xe74c3c, label:'Fire Station',       pop:0,  jobs:8,  cost:1100, taxBase:0,   growth:0, happinessBonus:4,  growthBonus:0, serviceRadius:5, crimeReduction:0,   fireProtection:0.5 },
};

export const TOOLTIP_DATA = {
  residential: { title:'Residential',      cost:'$400',  pop:'+15 base', jobs:'—',   tax:'$30/yr',  effect:'Grows over time'                              },
  commercial:  { title:'Commercial',       cost:'$600',  pop:'—',        jobs:'+20', tax:'$80/yr',  effect:'Generates revenue'                            },
  industrial:  { title:'Industrial',       cost:'$700',  pop:'—',        jobs:'+35', tax:'$120/yr', effect:'High employment'                              },
  road:        { title:'Road',             cost:'$80',   pop:'—',        jobs:'—',   tax:'—',       effect:'Connects zones (+50% eff)'                    },
  power:       { title:'Power Plant',      cost:'$1500', pop:'—',        jobs:'+5',  tax:'—',       effect:'Powers nearby tiles'                          },
  school:      { title:'School',           cost:'$900',  pop:'—',        jobs:'+8',  tax:'—',       effect:'+2 growth r=4 · +$10 tax/person · +15 happy'  },
  park:        { title:'Park',             cost:'$350',  pop:'—',        jobs:'+2',  tax:'—',       effect:'+12 happiness · +20% pop cap r=3'             },
  government:  { title:'Government Office',cost:'$1200', pop:'—',        jobs:'+15', tax:'—',       effect:'+8 happy · -30% unemp penalty · +15% tax r=5' },
  police:      { title:'Police Station',   cost:'$1000', pop:'—',        jobs:'+10', tax:'—',       effect:'-40% crime r=5 · +6 happy · prevents tax loss' },
  fire:        { title:'Fire Station',     cost:'$1100', pop:'—',        jobs:'+8',  tax:'—',       effect:'-50% fire risk r=5 · +4 happy · prevents damage'},
};
