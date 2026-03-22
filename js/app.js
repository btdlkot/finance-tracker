import * as store from './store.js';
import { formatMonthLabel, shiftMonth } from './ui.js';
import { render as renderDashboard } from './dashboard.js';
import { render as renderStatistics } from './statistics.js';

// ── Tab navigation ──

const tabButtons = document.querySelectorAll('.tabs__btn');
const views = {
  dashboard: document.getElementById('view-dashboard'),
  statistics: document.getElementById('view-statistics'),
};

let activeTab = 'dashboard';

function switchTab(tab) {
  activeTab = tab;
  tabButtons.forEach(btn => {
    btn.classList.toggle('tabs__btn--active', btn.dataset.tab === tab);
  });
  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle('view--active', name === tab);
  });
  renderActiveView();
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Month navigation ──

const monthLabel = document.getElementById('month-label');
const monthPrev = document.getElementById('month-prev');
const monthNext = document.getElementById('month-next');

function updateMonthLabel() {
  monthLabel.textContent = formatMonthLabel(store.getCurrentMonth());
}

monthPrev.addEventListener('click', () => {
  store.setCurrentMonth(shiftMonth(store.getCurrentMonth(), -1));
});

monthNext.addEventListener('click', () => {
  store.setCurrentMonth(shiftMonth(store.getCurrentMonth(), 1));
});

// ── Render ──

function renderActiveView() {
  updateMonthLabel();
  if (activeTab === 'dashboard') renderDashboard();
  else renderStatistics();
}

// Re-render on any state change
store.onStateChanged(() => renderActiveView());

// ── Init ──
renderActiveView();
