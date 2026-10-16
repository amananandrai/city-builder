import { state } from './state.js';
import { calcStats } from './simulation.js';
import { TOOLTIP_DATA } from './constants.js';
import { LEVELS, getLevel, ERAS } from './levels.js';

// ── HUD ───────────────────────────────────────────────────────────────────
export function updateHUD(s) {
  if (!s) s = calcStats();
  const level = getLevel(state.currentLevel);
  const goals = level.goals;

  document.getElementById('s-pop').textContent      = s.pop;
  document.getElementById('s-pop-goal').textContent = `/${goals.pop}`;
  document.getElementById('s-jobs').textContent     = s.jobs;
  document.getElementById('s-money').textContent    = state.money.toLocaleString();
  document.getElementById('s-power').textContent    = s.powerUsed;
  document.getElementById('s-pmax').textContent     = s.powerMax;
  document.getElementById('s-year').textContent     = state.year;
  document.getElementById('s-happy').textContent    = Math.round(s.happiness);
  document.getElementById('s-level').textContent    = state.currentLevel;

  // Service building counts
  document.getElementById('s-schools').textContent = s.activeSchoolCount  ?? 0;
  document.getElementById('s-parks').textContent   = s.activeParkCount    ?? 0;
  document.getElementById('s-govs').textContent    = s.activeGovCount     ?? 0;
  document.getElementById('s-police').textContent  = s.activePoliceCount  ?? 0;
  document.getElementById('s-fire').textContent    = s.activeFireCount    ?? 0;

  // Colour pop counter green when goal met
  document.getElementById('s-pop').style.color = s.pop >= goals.pop ? '#2ecc71' : '#7ec8e3';

  // Colour happiness: green ≥ goal, orange = ok, red = low
  const happyEl  = document.getElementById('s-happy');
  const happyGoal = goals.happiness;
  happyEl.style.color = s.happiness >= happyGoal ? '#2ecc71'
                      : s.happiness >= happyGoal - 10 ? '#e67e22'
                      : '#e74c3c';
}

// ── Alerts ────────────────────────────────────────────────────────────────
const alertSet = new Set();
export function showAlert(msg, type = 'info') {
  if (alertSet.has(msg)) return;
  alertSet.add(msg);
  const el = document.createElement('div');
  el.className = `alert ${type}`;
  el.textContent = msg;
  document.getElementById('alerts').appendChild(el);
  setTimeout(() => { el.remove(); alertSet.delete(msg); }, 4000);
}

// ── Tooltip ───────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

export function showTooltip(tool) {
  const d = TOOLTIP_DATA[tool];
  if (!d) { tooltip.style.display = 'none'; return; }

  // Show actual cost with level multiplier applied
  const mult = getLevel(state.currentLevel).constraints.costMult;
  const baseCost = parseInt(d.cost.replace(/\D/g, ''));
  const realCost = Math.round(baseCost * mult);

  tooltip.className = tool;
  document.getElementById('tt-title').textContent  = d.title;
  document.getElementById('tt-cost').textContent   = `$${realCost.toLocaleString()}`;
  document.getElementById('tt-pop').textContent    = d.pop;
  document.getElementById('tt-jobs').textContent   = d.jobs;
  document.getElementById('tt-tax').textContent    = d.tax;
  document.getElementById('tt-effect').textContent = d.effect || '—';
  tooltip.style.display = 'block';
}

// ── Level complete overlay ────────────────────────────────────────────────
export function showLevelComplete(levelId) {
  const isLast = levelId >= 50;
  const overlay = document.getElementById('level-complete');
  document.getElementById('lc-title').textContent  = isLast ? '🏆 Utopia Achieved!' : `🎉 Level ${levelId} Complete!`;
  document.getElementById('lc-sub').textContent    = isLast
    ? 'You\'ve conquered all 50 levels. You are a legendary city builder!'
    : `Ready for Level ${levelId + 1}: ${getLevel(levelId + 1).name}`;
  document.getElementById('lc-next-btn').textContent    = isLast ? 'Play Again' : `Next Level →`;
  document.getElementById('lc-next-btn').dataset.next   = isLast ? 'restart' : levelId + 1;
  overlay.style.display = 'flex';
}

// ── Level select screen ───────────────────────────────────────────────────
export function buildLevelSelect() {
  const container = document.getElementById('level-grid');
  container.innerHTML = '';
  const unlocked = parseInt(localStorage.getItem('cb_unlocked') || '1');

  // Group levels by era and render with era headers
  const byEra = {};
  LEVELS.forEach(lvl => {
    if (!byEra[lvl.era]) byEra[lvl.era] = [];
    byEra[lvl.era].push(lvl);
  });

  Object.keys(byEra).forEach(eraId => {
    const era  = ERAS[eraId];
    const lvls = byEra[eraId];

    // Era header
    const header = document.createElement('div');
    header.className = 'era-header';
    header.innerHTML = `<span class="era-dot" style="background:${era.color}"></span>${era.name} <span class="era-range">${era.range}</span>`;
    container.appendChild(header);

    // Grid row for this era
    const row = document.createElement('div');
    row.className = 'era-row';

    lvls.forEach(lvl => {
      const locked = lvl.id > unlocked;
      const stars  = Math.min(5, Math.ceil(lvl.id / 10));
      const card   = document.createElement('div');
      card.className = `lvl-card${locked ? ' locked' : ''}${lvl.id === state.currentLevel ? ' current' : ''}`;
      card.style.setProperty('--era-color', era.color);
      card.innerHTML = `
        <div class="lvl-num">${locked ? '🔒' : lvl.id}</div>
        <div class="lvl-name">${lvl.name}</div>
        <div class="lvl-goal">Pop ${lvl.goals.pop.toLocaleString()}</div>
        <div class="lvl-diff">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
      `;
      if (!locked) {
        card.addEventListener('click', () => {
          document.getElementById('level-select').style.display = 'none';
          startLevel(lvl.id);
        });
      }
      row.appendChild(card);
    });

    container.appendChild(row);
  });
}

// ── Toolbar wiring ────────────────────────────────────────────────────────
export function initToolbar(onToolChange) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onToolChange(btn.dataset.tool);
      showTooltip(btn.dataset.tool);
    });
    btn.addEventListener('mouseenter', () => showTooltip(btn.dataset.tool));
    btn.addEventListener('mouseleave', () => showTooltip(
      document.querySelector('.tool-btn.active')?.dataset.tool
    ));
  });

  document.getElementById('tax-rate').addEventListener('input', e => {
    const cap = getLevel(state.currentLevel).constraints.taxCapPct;
    state.taxRate = Math.max(0, Math.min(cap, parseInt(e.target.value) || 0));
    // Clamp input visually
    e.target.value = state.taxRate;
  });
}

// ── Welcome → level select ────────────────────────────────────────────────
export function initWelcome() {
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('level-select').style.display = 'flex';
    buildLevelSelect();
  });
  document.getElementById('ls-back-btn').addEventListener('click', () => {
    document.getElementById('level-select').style.display = 'none';
    document.getElementById('welcome').style.display = 'flex';
  });
}

// ── Level complete next button ────────────────────────────────────────────
export function initLevelComplete(onNext) {
  document.getElementById('lc-next-btn').addEventListener('click', e => {
    const next = e.target.dataset.next;
    document.getElementById('level-complete').style.display = 'none';
    if (next === 'restart') {
      location.reload();
    } else {
      onNext(parseInt(next));
    }
  });
}

// Imported lazily by simulation.js — re-export startLevel so it's available
let _startLevel = null;
export function registerStartLevel(fn) { _startLevel = fn; }
function startLevel(id) { if (_startLevel) _startLevel(id); }
