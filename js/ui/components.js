// js/ui/components.js
// Reusable, logic-free render components. Each takes data and returns an HTML
// string (or operates on the DOM for overlays). No business math lives here.
import { icon } from './icons.js';
import { formatINR } from '../lib/calc.js';
import { getCategory } from '../lib/categories.js';

/** Escape text for safe insertion into HTML. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * KPI card. { label, value, iconName, tone, sub, ring }
 * tone: 'primary'|'success'|'warning'|'danger'|'neutral'
 * sub:  optional small line (e.g. trend). ring: optional 0..100 progress ring.
 */
export function kpiCard({ label, value, iconName = 'wallet', tone = 'primary', sub = '', ring = null }) {
  const ringHtml =
    ring != null
      ? `<div class="kpi-ring" style="--pct:${Math.max(0, Math.min(100, ring))}">
           <span>${Math.round(ring)}%</span>
         </div>`
      : '';
  return `
  <article class="card kpi kpi-${tone}" tabindex="0">
    <div class="kpi-top">
      <span class="kpi-icon kpi-icon-${tone}">${icon(iconName, { size: 20 })}</span>
      ${ringHtml}
    </div>
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-value">${esc(value)}</span>
    ${sub ? `<span class="kpi-sub">${sub}</span>` : ''}
  </article>`;
}

/** Trend sub-line for a KPI: colored arrow + percent vs previous period. */
export function trendSub({ deltaPct, direction }) {
  const cls = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat';
  const ic = direction === 'down' ? 'trendDown' : 'trendUp';
  const sign = deltaPct > 0 ? '+' : '';
  return `<span class="trend trend-${cls}">${icon(ic, { size: 14 })} ${sign}${deltaPct}% vs last month</span>`;
}

/** Category badge (icon + colored dot + label). */
export function categoryBadge(categoryId) {
  const c = getCategory(categoryId);
  return `<span class="cat-badge" style="--cat:${c.color}">
    <span class="cat-dot">${icon(c.icon, { size: 13 })}</span>${esc(c.label)}
  </span>`;
}

/**
 * A budget-vs-actual progress row for one category.
 * { label, spent, budget, pct } — pct is the clamped 0..100 fill width.
 * State classes: `.over` when spent > budget, `.warn` when pct >= 85.
 * When `budget` is 0 the row shows spend only (no fill), since there's no target.
 */
export function budgetBar({ label, spent, budget, pct }) {
  const hasBudget = Number(budget) > 0;
  const over = hasBudget && spent > budget;
  const warn = hasBudget && !over && pct >= 85;
  const stateCls = over ? 'over' : warn ? 'warn' : '';
  const right = hasBudget
    ? `${formatINR(spent)} <span class="bb-sep">/</span> ${formatINR(budget)}`
    : `${formatINR(spent)} <span class="bb-sep">·</span> no budget`;
  return `
  <div class="budget-row">
    <div class="budget-row-top">
      <span class="bb-label">${esc(label)}</span>
      <span class="bb-amt ${over ? 'neg' : ''}">${right}</span>
    </div>
    <div class="bb-track"><span class="bb-fill ${stateCls}" style="width:${hasBudget ? Math.max(0, Math.min(100, pct)) : 0}%"></span></div>
  </div>`;
}

/** Payment-mode chip. */
export function modeChip(mode) {
  return `<span class="mode-chip mode-${esc(String(mode).toLowerCase())}">${esc(mode || '—')}</span>`;
}

/** A card wrapper for a chart with a title + fixed-height canvas. */
export function chartCard({ title, canvasId, action = '' }) {
  return `
  <section class="card chart-card">
    <div class="card-head">
      <h2>${esc(title)}</h2>
      ${action}
    </div>
    <div class="chart-holder"><canvas id="${canvasId}"></canvas></div>
  </section>`;
}

/** Empty-state block. */
export function emptyState({ iconName = 'receipt', title, text, ctaId = '', ctaLabel = '' }) {
  return `
  <div class="empty-state">
    <span class="empty-icon">${icon(iconName, { size: 40, strokeWidth: 1.5 })}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${ctaId ? `<button class="btn primary" id="${ctaId}">${icon('plus', { size: 16 })} ${esc(ctaLabel)}</button>` : ''}
  </div>`;
}

/** Skeleton rows for loading state. */
export function skeletonCards(n = 6) {
  return `<div class="kpis">${Array.from({ length: n })
    .map(() => `<div class="card kpi skeleton"><div class="sk-line sk-sm"></div><div class="sk-line sk-lg"></div></div>`)
    .join('')}</div>`;
}

/* ---------------- Overlay components (operate on DOM) ---------------- */

let toastTimer = null;
/** Transient toast. kind: 'success'|'error'|'info' */
export function toast(message, kind = 'info') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  const ic = kind === 'success' ? 'check' : kind === 'error' ? 'alert' : 'receipt';
  el.innerHTML = `${icon(ic, { size: 16 })}<span>${esc(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

/**
 * Confirm dialog (focus-trapped). Returns a Promise<boolean>.
 * Used before destructive actions (delete).
 */
export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
        <h3 id="cd-title">${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn ghost" data-cd="cancel">Cancel</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-cd="ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));

    const done = (val) => {
      back.classList.remove('show');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    };
    back.addEventListener('click', (e) => {
      if (e.target === back) done(false);
      const act = e.target.closest('[data-cd]')?.dataset.cd;
      if (act === 'ok') done(true);
      if (act === 'cancel') done(false);
    });
    document.addEventListener('keydown', onKey);
    back.querySelector('[data-cd="ok"]').focus();
  });
}

/**
 * PIN prompt dialog (focus-trapped). Returns Promise<string|null> — the entered
 * PIN, or null if cancelled. Shown at transaction time; `message` can explain
 * why (e.g. a wrong-PIN retry).
 */
export function promptPin({ title = 'Enter PIN', message = 'Enter your PIN to save this change.', confirmLabel = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal pin-modal" role="dialog" aria-modal="true" aria-labelledby="pp-title">
        <h3 id="pp-title">${esc(title)}</h3>
        <p>${esc(message)}</p>
        <form class="pin-form" novalidate>
          <input id="pp-input" type="password" inputmode="numeric" autocomplete="off"
                 placeholder="PIN" aria-label="PIN" class="pin-field" />
          <div class="modal-actions">
            <button type="button" class="btn ghost" data-pp="cancel">Cancel</button>
            <button type="submit" class="btn primary" data-pp="ok">${esc(confirmLabel)}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    const input = back.querySelector('#pp-input');

    const done = (val) => {
      back.classList.remove('show');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
      resolve(val);
    };
    const submit = () => {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      done(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Tab') trapTab(e, back.querySelector('.modal'));
    };
    back.addEventListener('click', (e) => {
      if (e.target === back) done(null);
      if (e.target.closest('[data-pp="cancel"]')) done(null);
    });
    back.querySelector('.pin-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    document.addEventListener('keydown', onKey);
    input.focus();
  });
}

/**
 * Drawer (side sheet on desktop, bottom sheet on mobile). Focus-trapped.
 * open({ title, bodyHtml, onMount, onSubmit }) -> controller with close().
 */
export function openDrawer({ title, bodyHtml, onMount, onClose }) {
  const prev = document.activeElement;
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  back.innerHTML = `
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title">
      <header class="drawer-head">
        <h2 id="dr-title">${esc(title)}</h2>
        <button class="icon-btn" data-drawer-close aria-label="Close">${icon('close', { size: 20 })}</button>
      </header>
      <div class="drawer-body">${bodyHtml}</div>
    </aside>`;
  document.body.appendChild(back);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => back.classList.add('show'));

  const close = () => {
    back.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => back.remove(), 250);
    document.removeEventListener('keydown', onKey);
    if (prev && prev.focus) prev.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapTab(e, back.querySelector('.drawer'));
  };
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
    if (e.target.closest('[data-drawer-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  if (onMount) onMount(back.querySelector('.drawer-body'), close);
  const first = back.querySelector('input, select, textarea, button');
  if (first) first.focus();
  return { close, root: back };
}

function trapTab(e, container) {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Format helper re-export for views. */
export { formatINR };
