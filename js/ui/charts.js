// js/ui/charts.js
// Chart.js wrappers. Chart.js is loaded via CDN (global `Chart`). Each factory
// destroys any prior instance on the canvas before creating a new one, so views
// can call render repeatedly on data change without leaking.
import { formatINR, monthlySeries, categoryBreakdown, vendorTotals } from '../lib/calc.js';
import { categoryColor } from '../lib/categories.js';

const instances = new Map();

function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (v, fb) => (css.getPropertyValue(v) || fb).trim();
  return {
    grid: get('--chart-grid', 'rgba(100,116,139,0.15)'),
    text: get('--chart-text', '#64748b'),
    primary: get('--primary', '#4f46e5'),
    primarySoft: get('--primary-soft', 'rgba(79,70,229,0.15)'),
  };
}

function available() {
  return typeof window !== 'undefined' && typeof window.Chart !== 'undefined';
}

/** Common tooltip money formatter. */
function moneyTooltip() {
  return {
    callbacks: {
      // `ctx.raw` is the original datum (a plain number for every chart here),
      // so it's correct regardless of bar orientation. `ctx.parsed` is an {x,y}
      // object whose value axis flips with indexAxis, so we only fall back to it.
      label: (ctx) => {
        let v = ctx.raw;
        if (typeof v !== 'number') {
          const p = ctx.parsed;
          v = p && typeof p === 'object' ? (p.x ?? p.y ?? 0) : (p ?? 0);
        }
        return ` ${formatINR(v)}`;
      },
    },
  };
}

function destroyIfAny(canvasId) {
  if (instances.has(canvasId)) {
    instances.get(canvasId).destroy();
    instances.delete(canvasId);
  }
}

function baseOptions(t, { legend = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 420, easing: 'easeOutQuart' },
    plugins: {
      legend: legend
        ? { position: 'bottom', labels: { color: t.text, usePointStyle: true, padding: 14, font: { size: 12 } } }
        : { display: false },
      tooltip: {
        ...moneyTooltip(),
        backgroundColor: '#0f172a',
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: '600' },
      },
    },
  };
}

/** Monthly expenses bar chart. */
export function renderMonthlyBar(canvasId, expenses, { months = 6, ref } = {}) {
  if (!available()) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const t = themeColors();
  const series = monthlySeries(expenses, months, ref || new Date());
  destroyIfAny(canvasId);
  const chart = new window.Chart(el, {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [{
        data: series.map((s) => s.total),
        backgroundColor: t.primary,
        hoverBackgroundColor: t.primary,
        borderRadius: 8,
        maxBarThickness: 48,
      }],
    },
    options: {
      ...baseOptions(t),
      scales: {
        x: { grid: { display: false }, ticks: { color: t.text } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => shortINR(v) }, beginAtZero: true },
      },
    },
  });
  instances.set(canvasId, chart);
  return chart;
}

/**
 * Vendor-wise paid total — horizontal bar chart (how much paid to each vendor).
 * `vendorName` is an (id)=>name resolver; `top` limits to the biggest N vendors.
 */
export function renderVendorBar(canvasId, expenses, { vendorName, top = 10 } = {}) {
  if (!available()) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const t = themeColors();
  const rows = vendorTotals(expenses, vendorName).slice(0, top);
  destroyIfAny(canvasId);
  const chart = new window.Chart(el, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.name),
      datasets: [{
        data: rows.map((r) => r.total),
        backgroundColor: t.primary,
        hoverBackgroundColor: t.primary,
        borderRadius: 8,
        maxBarThickness: 36,
      }],
    },
    options: {
      ...baseOptions(t),
      indexAxis: 'y',
      scales: {
        x: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => shortINR(v) }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: t.text } },
      },
    },
  });
  instances.set(canvasId, chart);
  return chart;
}

/** Category donut chart with center-total via plugin. */
export function renderCategoryDonut(canvasId, expenses) {
  if (!available()) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const t = themeColors();
  const data = categoryBreakdown(expenses);
  destroyIfAny(canvasId);
  const chart = new window.Chart(el, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.category),
      datasets: [{
        data: data.map((d) => d.total),
        backgroundColor: data.map((d) => categoryColor(d.category)),
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      ...baseOptions(t, { legend: true }),
      cutout: '64%',
    },
  });
  instances.set(canvasId, chart);
  return chart;
}

/** Expense trend line over the last N months. */
export function renderTrendLine(canvasId, expenses, { months = 6, ref } = {}) {
  if (!available()) return null;
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const t = themeColors();
  const series = monthlySeries(expenses, months, ref || new Date());
  destroyIfAny(canvasId);
  const chart = new window.Chart(el, {
    type: 'line',
    data: {
      labels: series.map((s) => s.label),
      datasets: [{
        data: series.map((s) => s.total),
        borderColor: t.primary,
        backgroundColor: t.primarySoft,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: t.primary,
        pointHoverRadius: 6,
      }],
    },
    options: {
      ...baseOptions(t),
      scales: {
        x: { grid: { display: false }, ticks: { color: t.text } },
        y: { grid: { color: t.grid }, ticks: { color: t.text, callback: (v) => shortINR(v) }, beginAtZero: true },
      },
    },
  });
  instances.set(canvasId, chart);
  return chart;
}

/** Destroy all charts (on view change). */
export function destroyAllCharts() {
  for (const c of instances.values()) c.destroy();
  instances.clear();
}

export function chartsAvailable() {
  return available();
}

/** Compact INR for axis ticks: 1,00,000 -> ₹1L, 5000 -> ₹5k. */
function shortINR(v) {
  const n = Number(v) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}
