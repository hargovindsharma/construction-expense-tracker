// js/app.js — application bootstrap: hash router, theme, PIN wiring, nav.
// Views are render-only modules that read the store; this file wires them to
// the DOM shell and keeps the active view in sync with store changes.
import { icon } from './ui/icons.js';
import { loadData, subscribe } from './store.js';
import { renderDashboard } from './views/dashboard.js';
import { renderExpenses } from './views/expenses.js';
import { renderVendors } from './views/vendors.js';
import { renderReports } from './views/reports.js';
import { renderSettings } from './views/settings.js';
import { openExpenseDrawer } from './views/expense-drawer.js';
import { destroyAllCharts } from './ui/charts.js';

const THEME_KEY = 'cet_theme';

const ROUTES = {
  dashboard: { title: 'Dashboard', icon: 'dashboard', render: renderDashboard },
  expenses: { title: 'All Expenses', icon: 'receipt', render: renderExpenses },
  vendors: { title: 'Vendors', icon: 'users', render: renderVendors },
  reports: { title: 'Reports', icon: 'chart', render: renderReports },
  settings: { title: 'Settings', icon: 'settings', render: renderSettings },
};

const $ = (id) => document.getElementById(id);
let current = 'dashboard';

/* ---------------- Theme ---------------- */
export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}
export function setTheme(mode) {
  if (mode === 'system') localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, mode);
  applyTheme();
}
function resolvedTheme() {
  const m = getTheme();
  if (m === 'light' || m === 'dark') return m;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('theme-btn');
  if (btn) {
    btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', { size: 20 });
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  // Redraw charts so their colors track the theme.
  if (ROUTES[current]) renderCurrent();
}

/* ---------------- Nav ---------------- */
function buildNav() {
  const links = document.querySelectorAll('.nav-link, .tab');
  links.forEach((el) => {
    const r = el.dataset.route;
    const route = ROUTES[r];
    if (!route) return;
    const isTab = el.classList.contains('tab');
    el.innerHTML = `${icon(route.icon, { size: isTab ? 22 : 20 })}<span>${route.title === 'All Expenses' ? 'Expenses' : route.title}</span>`;
  });
}
function highlightNav() {
  document.querySelectorAll('.nav-link, .tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === current);
    if (el.dataset.route === current) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

/* ---------------- Router ---------------- */
function parseRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROUTES[h] ? h : 'dashboard';
}
function renderCurrent() {
  const view = $('view');
  if (!view) return;
  ROUTES[current].render(view);
}
function navigate() {
  destroyAllCharts();
  current = parseRoute();
  $('topbar-title').textContent = ROUTES[current].title;
  highlightNav();
  renderCurrent();
  $('view').focus({ preventScroll: true });
  closeSidebar();
}

/* ---------------- Sidebar (mobile) ---------------- */
function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebar-backdrop').classList.add('show');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-backdrop').classList.remove('show');
}

/* ---------------- Bootstrap ---------------- */
function init() {
  buildNav();
  applyTheme();

  $('theme-btn')?.addEventListener('click', () => {
    // Cycle through the resolved opposite for a quick toggle.
    setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
  });
  $('menu-btn')?.addEventListener('click', openSidebar);
  $('sidebar-backdrop')?.addEventListener('click', closeSidebar);
  $('add-expense-btn')?.addEventListener('click', () => openExpenseDrawer());

  // React to system theme changes when in 'system' mode.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme();
    });
  }

  // Store → re-render current view on every change.
  subscribe(() => {
    renderCurrent();
  });

  window.addEventListener('hashchange', navigate);

  // Chart.js may still be loading (defer); redraw once it's ready.
  window.addEventListener('load', () => {
    if (typeof window.Chart !== 'undefined') renderCurrent();
  });

  navigate();
  loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
