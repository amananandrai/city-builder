import { state, nextLandCost } from './state.js';
import { calcStats, yearlyIncome, yearlyUpkeep } from './simulation.js';
import { TOOLTIP_DATA, ZONE_DEF, MONTH_MS, MONTH_NAMES, GRID, dayPhase, clockHour, BUILD_STYLES } from './constants.js';
import { LEVELS, getLevel, ERAS } from './levels.js';
import { on } from './events.js';
import { objectives, advise } from './advisor.js';

const $ = id => document.getElementById(id);

// Callbacks supplied by main.js (startLevel, beginLevel, setSpeed)
let game = {};
export function registerGame(handlers) { game = handlers; }

// ── Progress (localStorage, wrapped so private mode can't break the game) ──
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export const progress = {
  unlocked:  () => Math.max(1, parseInt(load('cb_unlocked', 1)) || 1),
  completed: () => new Set(load('cb_completed', [])),
  unlock(id) { if (id > this.unlocked()) save('cb_unlocked', Math.min(id, LEVELS.length)); },
  complete(id) { const c = this.completed(); c.add(id); save('cb_completed', [...c]); this.unlock(id + 1); },
};

const costOf = type => Math.round(ZONE_DEF[type].cost * getLevel(state.currentLevel).constraints.costMult);

// ── HUD ───────────────────────────────────────────────────────────────────
// ── Animated counters ─────────────────────────────────────────────────────
const tweens = new Map();
/** Set a numeric HUD value, counting up/down to it instead of jumping. */
function setNumber(el, value) {
  let st = tweens.get(el);
  if (!st) {
    tweens.set(el, { shown: value });
    el.textContent = value.toLocaleString();
    return;
  }
  if (st.to === value || (!st.running && st.shown === value)) return;
  st.from = st.shown; st.to = value; st.t0 = performance.now();
  if (st.running) return;
  st.running = true;
  const step = now => {
    const k = Math.min(1, (now - st.t0) / 450);
    st.shown = Math.round(st.from + (st.to - st.from) * (1 - (1 - k) ** 3));
    el.textContent = st.shown.toLocaleString();
    if (k < 1) requestAnimationFrame(step); else st.running = false;
  };
  requestAnimationFrame(step);
}

// ── Month-over-month trend arrows ─────────────────────────────────────────
let lastMonth = null;
function setTrend(id, delta) {
  const el = $(id);
  el.textContent = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
  el.className = `trend ${delta > 0 ? 'up' : 'down'}`;
}
on('month', ({ stats }) => {
  if (state.monthsPlayed <= 1) lastMonth = null; // new level
  if (lastMonth) {
    setTrend('t-pop', stats.pop - lastMonth.pop);
    setTrend('t-happy', Math.round(stats.happiness) - lastMonth.happiness);
  } else { setTrend('t-pop', 0); setTrend('t-happy', 0); }
  lastMonth = { pop: stats.pop, happiness: Math.round(stats.happiness) };
});

// ── History chart: population and cash over the last few years ────────────
const history = [];
function drawHistory() {
  const c = $('hist-canvas'), ctx = c.getContext('2d');
  const W = c.width, H = c.height, pad = 6;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (const y of [pad, H / 2, H - pad]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (history.length < 2) return;
  const line = (key, color) => {
    const vals = history.map(h => h[key]);
    const lo = Math.min(...vals, 0), hi = Math.max(...vals, lo + 1);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * W, y = H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  line('cash', '#2ecc71');
  line('pop', '#7dd3fc');
}
on('month', ({ stats }) => {
  if (state.monthsPlayed <= 1) history.length = 0; // new level
  history.push({ pop: stats.pop, cash: state.money });
  if (history.length > 60) history.shift();
  drawHistory();
});

// ── Happiness breakdown (hover the happiness stat) ────────────────────────
let lastStats = null;
function renderHappyTip() {
  const tip = $('happy-tip');
  if (tip.style.display !== 'block' || !lastStats) return;
  const rows = lastStats.happyParts.map(([label, v]) => {
    const n = Math.round(v);
    const cls = label === 'Base' ? '' : n > 0 ? 'ok' : 'bad';
    return `<div class="ht-row"><span>${label}</span><b class="${cls}">${label === 'Base' ? n : (n > 0 ? '+' : '−') + Math.abs(n)}</b></div>`;
  }).join('');
  tip.innerHTML = `<div class="ht-title">Happiness</div>${rows}` +
    `<div class="ht-row total"><span>Total (0–100)</span><b>${Math.round(lastStats.happiness)}%</b></div>`;
  const r = $('happy-stat').getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(innerWidth - 228, r.left + r.width / 2 - 110))}px`;
  tip.style.bottom = `${innerHeight - r.top + 14}px`;
}

export function updateHUD(s) {
  if (!s) s = calcStats();
  lastStats = s;
  renderHappyTip();
  const level = getLevel(state.currentLevel);
  const goals = level.goals;

  setNumber($('s-pop'), s.pop);
  $('s-pop-goal').textContent = `/${goals.pop.toLocaleString()}`;
  setNumber($('s-jobs'), s.jobs);
  setNumber($('s-money'), state.money);
  $('s-power').textContent    = s.powerUsed;
  $('s-pmax').textContent     = s.powerMax;
  renderDate();
  $('s-happy').textContent    = Math.round(s.happiness);
  $('s-level').textContent    = state.currentLevel;
  renderLand(level);

  const net = yearlyIncome(s) - yearlyUpkeep(s);
  const netEl = $('s-net');
  netEl.textContent = `${net >= 0 ? '+' : '−'}$${Math.abs(net).toLocaleString()}/yr`;
  netEl.className = `net ${net >= 0 ? 'pos' : 'neg'}`;
  $('s-money').style.color = state.money < 0 ? '#e74c3c' : '';

  // Service building counts
  $('s-schools').textContent = s.activeSchoolCount ?? 0;
  $('s-parks').textContent   = s.activeParkCount   ?? 0;
  $('s-govs').textContent    = s.activeGovCount    ?? 0;
  $('s-police').textContent  = s.activePoliceCount ?? 0;
  $('s-fire').textContent    = s.activeFireCount   ?? 0;

  $('s-pop').style.color = s.pop >= goals.pop ? '#2ecc71' : '#7ec8e3';
  const happyGoal = goals.happiness;
  $('s-happy').style.color = s.happiness >= happyGoal ? '#2ecc71'
                           : s.happiness >= happyGoal - 10 ? '#e67e22'
                           : '#e74c3c';
  $('s-power').style.color = s.powerUsed > s.powerMax ? '#e74c3c' : '';

  // Dim tools the player can't currently afford
  document.querySelectorAll('.tool-btn').forEach(btn => {
    const t = btn.dataset.tool;
    btn.classList.toggle('cant-afford', !!ZONE_DEF[t] && state.money < costOf(t));
  });

  renderObjectives(s);
  renderAdvisor(s);
}

// ── Objectives panel ──────────────────────────────────────────────────────
function renderObjectives(s) {
  const level = getLevel(state.currentLevel);
  $('obj-level').textContent = `Level ${level.id} · ${level.name}`;
  $('obj-rows').innerHTML = objectives(s).map(r => {
    const pct = Math.max(0, Math.min(100, (r.value / r.target) * 100));
    const v = `${r.prefix ?? ''}${Math.max(0, r.value).toLocaleString()}${r.suffix ?? ''}`;
    const t = `${r.prefix ?? ''}${r.target.toLocaleString()}${r.suffix ?? ''}`;
    return `<div class="obj-row${r.met ? ' met' : ''}">
      <div class="obj-top"><span>${r.met ? '✅' : r.icon} ${r.label}</span><b>${v} / ${t}</b></div>
      <div class="obj-bar"><div class="obj-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

// ── Advisor ───────────────────────────────────────────────────────────────
let lastAdvice = '';
function renderAdvisor(s) {
  const a = advise(s);
  const box = $('advisor');
  box.className = a.tone;
  $('adv-step').textContent = a.step ? `Step ${a.step} of 4` : '';
  $('adv-title').textContent = `${a.icon} ${a.title}`;
  $('adv-text').textContent = a.text;
  const btn = $('adv-tool');
  if (a.tool) {
    btn.style.display = 'inline-block';
    btn.textContent = `Select ${TOOLTIP_DATA[a.tool].title}`;
    btn.dataset.tool = a.tool;
  } else {
    btn.style.display = 'none';
  }
  // Pulse the toolbar button during the first-build walkthrough
  document.querySelectorAll('.tool-btn').forEach(b =>
    b.classList.toggle('nudge', !!a.step && b.dataset.tool === a.tool && !b.classList.contains('active')));
  if (a.title !== lastAdvice) {
    lastAdvice = a.title;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
  }
}

// ── Alerts ────────────────────────────────────────────────────────────────
const alertSet = new Set();
export function showAlert(msg, type = 'info') {
  if (alertSet.has(msg)) return;
  alertSet.add(msg);
  const el = document.createElement('div');
  el.className = `alert ${type}`;
  el.textContent = msg;
  $('alerts').appendChild(el);
  setTimeout(() => { el.remove(); alertSet.delete(msg); }, 4500);
}

// ── Tooltip ───────────────────────────────────────────────────────────────
const tooltip = $('tooltip');

export function showTooltip(tool) {
  const d = TOOLTIP_DATA[tool];
  if (!d || !state.running) { tooltip.style.display = 'none'; return; }
  const realCost = ZONE_DEF[tool] ? costOf(tool) : null;

  tooltip.className = tool;
  $('tt-title').textContent  = d.title;
  $('tt-cost').textContent   = realCost !== null ? `$${realCost.toLocaleString()}` : '—';
  $('tt-pop').textContent    = d.pop;
  $('tt-jobs').textContent   = d.jobs;
  $('tt-tax').textContent    = d.tax;
  $('tt-effect').textContent = d.effect || '—';
  tooltip.style.display = 'block';
}

// ── Screens ───────────────────────────────────────────────────────────────
const SCREENS = ['welcome', 'level-select', 'briefing', 'level-complete'];
/** True while a full-screen overlay is up; the simulation clock stops. */
export const modalOpen = () => SCREENS.some(s => $(s).style.display === 'flex');

function showScreen(id) {
  for (const s of SCREENS) $(s).style.display = s === id ? 'flex' : 'none';
  const inGame = id === null || id === 'briefing';
  $('side-panel').style.display = inGame ? 'flex' : 'none';
  $('overlay-bar').style.display = inGame ? 'flex' : 'none';
  if (!id) showTooltip(document.querySelector('.tool-btn.active')?.dataset.tool);
  else tooltip.style.display = 'none';
}

// ── How-to-play guide ─────────────────────────────────────────────────────
let guideStep = 0;
const steps = () => [...document.querySelectorAll('.guide-step')];

function renderGuide() {
  const all = steps();
  all.forEach((el, i) => el.classList.toggle('active', i === guideStep));
  $('guide-dots').innerHTML = all.map((el, i) =>
    `<button class="${i === guideStep ? 'active' : ''}" data-i="${i}" title="${el.dataset.title}"></button>`).join('');
  $('guide-back').style.visibility = guideStep === 0 ? 'hidden' : 'visible';
  const last = guideStep === all.length - 1;
  $('start-btn').textContent = last ? (state.running ? 'Back to my city →' : 'Choose a level →') : 'Next →';
  $('guide-skip').style.visibility = last ? 'hidden' : 'visible';
  $('guide-skip').textContent = state.running ? 'Close' : 'Skip to levels';
}

function finishGuide() {
  save('cb_seen_guide', true);
  if (state.running) showScreen(null);
  else openLevelSelect();
}

export function openGuide(step = 0) {
  guideStep = step;
  renderGuide();
  showScreen('welcome');
}

function buildPowerDemo() {
  const grid = document.querySelector('.power-demo');
  const cells = [];
  for (let z = 0; z < 5; z++) for (let x = 0; x < 9; x++) {
    const d = Math.abs(x - 4) + Math.abs(z - 2);
    cells.push(`<div class="${d === 0 ? 'plant' : d <= 2 ? 'lit' : ''}"></div>`);
  }
  grid.innerHTML = cells.join('');
}

export function initWelcome() {
  buildPowerDemo();
  $('start-btn').addEventListener('click', () => {
    if (guideStep < steps().length - 1) { guideStep++; renderGuide(); }
    else finishGuide();
  });
  $('guide-back').addEventListener('click', () => { guideStep = Math.max(0, guideStep - 1); renderGuide(); });
  $('guide-skip').addEventListener('click', finishGuide);
  $('guide-dots').addEventListener('click', e => {
    if (e.target.dataset.i !== undefined) { guideStep = +e.target.dataset.i; renderGuide(); }
  });
  $('ls-back-btn').addEventListener('click', () => openGuide(0));
  $('ls-continue').addEventListener('click', () => game.startLevel(progress.unlocked()));
  openGuide(0);
}

// ── Level select ──────────────────────────────────────────────────────────
export function openLevelSelect() {
  buildLevelSelect();
  showScreen('level-select');
}

export function buildLevelSelect() {
  const container = $('level-grid');
  container.innerHTML = '';
  const unlocked  = progress.unlocked();
  const completed = progress.completed();
  const next = getLevel(unlocked);

  $('ls-continue').textContent = completed.size === 0 && unlocked === 1
    ? '▶ Start Level 1: Empty Lot'
    : `▶ Continue: Level ${next.id} · ${next.name}`;
  $('ls-progress').textContent = `${completed.size} / ${LEVELS.length} levels completed`;

  const byEra = {};
  LEVELS.forEach(lvl => (byEra[lvl.era] ??= []).push(lvl));

  Object.keys(byEra).forEach(eraId => {
    const era  = ERAS[eraId];
    const header = document.createElement('div');
    header.className = 'era-header';
    header.innerHTML = `<span class="era-dot" style="background:${era.color}"></span>${era.name} <span class="era-range">Levels ${era.range}</span>`;
    container.appendChild(header);

    const row = document.createElement('div');
    row.className = 'era-row';
    byEra[eraId].forEach(lvl => {
      const locked = lvl.id > unlocked;
      const stars  = Math.min(5, Math.ceil(lvl.id / 10));
      const card   = document.createElement('div');
      card.className = `lvl-card${locked ? ' locked' : ''}${completed.has(lvl.id) ? ' done' : ''}${lvl.id === unlocked && !completed.has(lvl.id) ? ' next' : ''}`;
      card.style.setProperty('--era-color', era.color);
      const g = lvl.goals;
      card.title = locked
        ? `Locked — complete Level ${lvl.id - 1} to unlock`
        : `${lvl.name}: ${lvl.description}\nGoals: ${g.pop.toLocaleString()} pop · ${g.happiness}% happy${g.jobs ? ` · ${g.jobs.toLocaleString()} jobs` : ''}${g.money ? ` · $${g.money.toLocaleString()} cash` : ''}`;
      card.innerHTML = `
        <div class="lvl-num">${locked ? '🔒' : lvl.id}</div>
        <div class="lvl-name">${lvl.name}</div>
        <div class="lvl-goal">Pop ${g.pop.toLocaleString()}</div>
        <div class="lvl-diff">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
      `;
      if (!locked) card.addEventListener('click', () => game.startLevel(lvl.id));
      row.appendChild(card);
    });
    container.appendChild(row);
  });
}

// ── Level briefing ────────────────────────────────────────────────────────
/** Show goals/rules. When the level is already running this is a recap. */
export function showBriefing() {
  const level = getLevel(state.currentLevel);
  const era = ERAS[level.era];
  $('br-era').textContent = `Level ${level.id} of ${LEVELS.length} · ${era.name} era`;
  $('br-era').style.color = era.color;
  $('br-name').textContent = level.name;
  $('br-desc').textContent = level.description;

  const g = level.goals;
  const goals = [['👥 Population', g.pop.toLocaleString()]];
  if (g.jobs)  goals.push(['💼 Jobs', g.jobs.toLocaleString()]);
  goals.push(['😊 Happiness', `${g.happiness}%`]);
  if (g.money) goals.push(['💰 Cash in the bank', `$${g.money.toLocaleString()}`]);
  $('br-goals').innerHTML = goals.map(([l, v]) => `<div class="br-goal"><b>${v}</b>${l}</div>`).join('');

  const c = level.constraints;
  const rules = [
    [`💵 Starting cash $${level.startMoney.toLocaleString()}`, true],
    [level.land >= GRID ? `🗺 Land ${GRID}×${GRID}` : `🗺 Land ${level.land}×${level.land} · buy more as you grow`, true],
    [`🏗 Build costs ×${c.costMult}`, c.costMult <= 1],
    [`💸 Tax cap ${c.taxCapPct}%`, c.taxCapPct >= 20],
    [`⚡ Power range ${c.powerRadius} tiles`, c.powerRadius >= 6],
    [c.budgetDrain > 0 ? `🔧 Upkeep up to $${c.budgetDrain.toLocaleString()}/yr` : '🔧 No upkeep', c.budgetDrain === 0],
  ];
  $('br-rules').innerHTML = rules.map(([t, easy]) => `<span class="br-rule${easy ? ' easy' : ''}">${t}</span>`).join('');
  $('br-hint').textContent = `💡 ${level.hint}`;
  $('br-start').textContent = state.running ? 'Back to my city →' : 'Start building →';
  showScreen('briefing');
}

// ── Level complete overlay ────────────────────────────────────────────────
export function showLevelComplete(levelId, s) {
  progress.complete(levelId);
  const isLast = levelId >= LEVELS.length;
  $('lc-title').textContent = isLast ? '🏆 Utopia Achieved!' : `🎉 Level ${levelId} Complete!`;
  $('lc-stats').innerHTML = [
    ['Time played', `${Math.floor(state.monthsPlayed / 12)}y ${state.monthsPlayed % 12}m`],
    ['Population', s.pop.toLocaleString()],
    ['Happiness', `${Math.round(s.happiness)}%`],
    ['Cash', `$${state.money.toLocaleString()}`],
  ].map(([l, v]) => `<div><b>${v}</b>${l}</div>`).join('');
  $('lc-sub').textContent = isLast
    ? 'You\'ve conquered all 50 levels. You are a legendary city builder!'
    : `Unlocked Level ${levelId + 1}: ${getLevel(levelId + 1).name} — ${getLevel(levelId + 1).description}`;
  $('lc-next-btn').textContent  = isLast ? 'Level select' : 'Next Level →';
  $('lc-next-btn').dataset.next = isLast ? 'levels' : levelId + 1;
  showScreen('level-complete');
  launchConfetti();
}

/** Short confetti burst over the level-complete card. */
function launchConfetti() {
  const c = document.createElement('canvas');
  c.id = 'confetti';
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const colors = ['#4a90d9', '#f39c12', '#8e44ad', '#1abc9c', '#e74c3c', '#f1c40f', '#2ecc71'];
  const parts = Array.from({ length: 160 }, (_, i) => {
    const side = i % 2 ? 1 : -1; // two cannons, bottom-left and bottom-right
    const a = (-Math.PI / 2) - side * (0.25 + Math.random() * 0.7);
    const v = 9 + Math.random() * 11;
    return {
      x: innerWidth / 2 + side * innerWidth * 0.32, y: innerHeight * 0.85,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: colors[i % colors.length],
    };
  });
  const t0 = performance.now();
  let last = t0;
  const frame = now => {
    const age = (now - t0) / 1000, dt = Math.min(2, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalAlpha = Math.max(0, Math.min(1, (3.4 - age) / 0.8));
    for (const p of parts) {
      p.vy += 0.28 * dt; p.vx *= 0.992; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      ctx.restore();
    }
    if (age < 3.4 && c.isConnected) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

export function initLevelComplete() {
  $('lc-next-btn').addEventListener('click', e => {
    const next = e.target.dataset.next;
    if (next === 'levels') openLevelSelect();
    else game.startLevel(parseInt(next));
  });
  $('lc-levels-btn').addEventListener('click', openLevelSelect);
  $('lc-stay-btn').addEventListener('click', () => showScreen(null));
}

// ── Toolbar, menu, time controls ──────────────────────────────────────────
export function setActiveTool(tool) {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  showTooltip(tool);
  renderStyleBar(tool);
}

/** Style chips under the toolbar for zones that offer a choice of building. */
function renderStyleBar(tool) {
  const bar = $('style-bar');
  const def = BUILD_STYLES[tool];
  if (!def) { bar.style.display = 'none'; return; }
  const current = state.styles[tool] ?? '';
  const chips = [{ id: '', icon: '✨', label: def.auto }, ...def.options];
  bar.innerHTML = `<span class="style-label">${ZONE_DEF[tool].label} style</span>` + chips.map(c =>
    `<button data-style="${c.id}" class="${c.id === current ? 'active' : ''}">${c.icon} ${c.label}</button>`).join('');
  bar.dataset.tool = tool;
  bar.style.display = 'flex';
}

export function initToolbar(onToolChange) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTool(btn.dataset.tool);
      onToolChange(btn.dataset.tool);
      updateHUD();
    });
    btn.addEventListener('mouseenter', () => showTooltip(btn.dataset.tool));
    btn.addEventListener('mouseleave', () => showTooltip(document.querySelector('.tool-btn.active')?.dataset.tool));
  });

  $('style-bar').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tool = $('style-bar').dataset.tool;
    if (btn.dataset.style) state.styles[tool] = btn.dataset.style;
    else delete state.styles[tool];
    renderStyleBar(tool);
  });

  $('tax-rate').addEventListener('input', e => {
    const cap = getLevel(state.currentLevel).constraints.taxCapPct;
    state.taxRate = Math.max(0, Math.min(cap, parseInt(e.target.value) || 0));
    e.target.value = state.taxRate;
    updateHUD();
  });

  $('adv-tool').addEventListener('click', e => {
    const tool = e.target.dataset.tool;
    if (!tool) return;
    setActiveTool(tool);
    onToolChange(tool);
    updateHUD();
  });

  // Menu
  const menu = $('menu');
  $('menu-btn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', e => {
    const action = e.target.dataset.menu;
    if (!action) return;
    menu.classList.remove('open');
    if (action === 'guide')    { openGuide(1); }
    if (action === 'briefing') { showBriefing(); }
    if (action === 'restart')  { if (confirm('Restart this level? Your city will be cleared.')) game.startLevel(state.currentLevel); }
    if (action === 'levels')   { openLevelSelect(); }
  });
  $('obj-info').addEventListener('click', () => { showBriefing(); });

  // Briefing buttons
  $('br-start').addEventListener('click', () => {
    showScreen(null);
    if (!state.running) game.beginLevel();
  });
  $('br-levels').addEventListener('click', openLevelSelect);

  const happyStat = $('happy-stat');
  happyStat.addEventListener('mouseenter', () => { $('happy-tip').style.display = 'block'; renderHappyTip(); });
  happyStat.addEventListener('mouseleave', () => { $('happy-tip').style.display = 'none'; });

  // Coverage views: click to show, click again to hide
  $('overlay-bar').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const on = !btn.classList.contains('active');
    document.querySelectorAll('#overlay-bar button').forEach(b => b.classList.toggle('active', on && b === btn));
    $('overlay-legend').style.display = on ? 'block' : 'none';
    game.setOverlay(on ? btn.dataset.overlay : null);
  });

  $('land-btn').addEventListener('click', () => game.buyLand());

  // Time controls
  document.querySelectorAll('#time-ctrl button').forEach(b =>
    b.addEventListener('click', () => game.setSpeed(parseInt(b.dataset.speed))));
}

/** Land button: current plot size and the price of the next ring. */
function renderLand(level) {
  const btn = $('land-btn');
  const cost = nextLandCost(level.constraints.costMult);
  btn.disabled = cost === null;
  btn.classList.toggle('poor', cost !== null && state.money < cost);
  const html = cost === null
    ? `<span>🗺</span> Land ${GRID}×${GRID} (max)`
    : `<span>🗺</span> Land ${state.land}×${state.land} · Buy more $${cost.toLocaleString()}`;
  if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
  btn.title = cost === null ? 'You own the whole valley.'
    : `Buy the next ring of land: grows your plot to ${state.land + 2}×${state.land + 2} for $${cost.toLocaleString()}`;
}

/** Reflect speed/pause state in the HUD. speed 0 = paused. */
export function renderTimeControls() {
  const current = state.paused ? 0 : state.speed;
  document.querySelectorAll('#time-ctrl button').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.speed) === current));
  $('paused-tag').style.display = state.paused && state.running && !modalOpen() ? 'block' : 'none';
}

/** Calendar and time of day, e.g. "Mar · Yr 2 · ☀ 14:20". */
export function renderDate() {
  const h = clockHour(dayPhase(state.dayClock));
  const hh = String(Math.floor(h)).padStart(2, '0');
  const mm = String(Math.floor((h % 1) * 6) * 10).padStart(2, '0'); // 10-minute steps
  const txt  = `${MONTH_NAMES[state.month]} · Yr ${state.year} · ${h >= 6 && h < 20 ? '☀' : '🌙'} ${hh}:${mm}`;
  const el = $('s-year');
  if (el.textContent !== txt) el.textContent = txt;
}

export function renderYearProgress() {
  $('year-fill').style.width = `${Math.min(100, (state.yearClock / (MONTH_MS / 1000)) * 100)}%`;
  renderDate();
}

export function setTaxCap(cap) {
  $('tax-rate').max = cap;
  $('tax-rate').value = state.taxRate;
  $('tax-cap').textContent = `/ ${cap}%`;
}

export { showScreen };
