// js/views/expenses.js
// Full "All Expenses" list: debounced search, category filter chips, date range,
// sortable columns, edit + delete per row. Filtering/sorting is pure (calc.js).
import { filterSortExpenses, formatINR } from '../lib/calc.js';
import { CATEGORIES, getCategory } from '../lib/categories.js';
import { categoryBadge, modeChip, emptyState, confirmDialog } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { getState, vendorName, saveExpense } from '../store.js';
import { openExpenseDrawer } from './expense-drawer.js';

// View-local UI state (not business data).
const ui = { query: '', category: '', from: '', to: '', sortBy: 'date', dir: 'desc' };
let searchTimer = null;

export function renderExpenses(mount) {
  const s = getState();
  if (s.loading) {
    mount.innerHTML = `<div class="view-head"><h1>All Expenses</h1></div><div class="card">Loading…</div>`;
    return;
  }

  const rows = filterSortExpenses(s.expenses, { ...ui, vendorName });
  const totalShown = rows.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const chips = [
    `<button class="fchip ${ui.category === '' ? 'active' : ''}" data-cat="">All</button>`,
    ...CATEGORIES.map((c) => `
      <button class="fchip ${ui.category === c.id ? 'active' : ''}" data-cat="${c.id}" style="--cat:${c.color}">
        ${icon(c.icon, { size: 13 })} ${c.label}
      </button>`),
  ].join('');

  const sortIndicator = (key) =>
    ui.sortBy === key ? `<span class="sort-ind">${ui.dir === 'asc' ? '▲' : '▼'}</span>` : '';

  const body = rows.length
    ? rows.map((e) => `
        <tr>
          <td class="nowrap">${fmtDate(e.date)}</td>
          <td>${categoryBadge(e.category)}</td>
          <td>${escName(vendorName(e.vendorId))}</td>
          <td class="desc">${escName(e.description || '')}${e.description && /verify|unverified/i.test(e.description) ? ' <span class="warn-dot" title="Needs review">⚠</span>' : ''}${e.reference ? `<span class="ref-sub">Ref: ${escName(e.reference)}</span>` : ''}</td>
          <td>${modeChip(e.paymentMode)}</td>
          <td class="num strong">${formatINR(e.amount)}</td>
          <td class="actions">
            <button class="icon-btn" data-edit="${e.id}" aria-label="Edit">${icon('edit', { size: 16 })}</button>
            <button class="icon-btn danger" data-del="${e.id}" aria-label="Delete">${icon('trash', { size: 16 })}</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="7">${emptyState({ iconName: 'search', title: 'No matching expenses', text: 'Try clearing filters or search.' })}</td></tr>`;

  mount.innerHTML = `
    <div class="view-head">
      <div><h1>All Expenses</h1><p class="view-sub">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · ${formatINR(totalShown)}</p></div>
      <button class="btn primary" id="exp-add">${icon('plus', { size: 16 })} Add Expense</button>
    </div>

    <section class="card toolbar">
      <div class="search-box">
        ${icon('search', { size: 16 })}
        <input id="exp-search" type="search" placeholder="Search vendor, note, or reference…" value="${escAttr(ui.query)}" autocomplete="off" />
      </div>
      <div class="date-range">
        <label>From <input id="exp-from" type="date" value="${escAttr(ui.from)}"></label>
        <label>To <input id="exp-to" type="date" value="${escAttr(ui.to)}"></label>
        ${ui.from || ui.to || ui.query || ui.category ? `<button class="btn ghost sm" id="exp-clear">Clear</button>` : ''}
      </div>
    </section>

    <div class="fchips">${chips}</div>

    <section class="card list-card">
      <div class="table-wrap">
        <table class="data-table sortable">
          <thead>
            <tr>
              <th data-sort="date" class="sortable-th">Date ${sortIndicator('date')}</th>
              <th>Category</th>
              <th data-sort="vendor" class="sortable-th">Vendor ${sortIndicator('vendor')}</th>
              <th>Description</th>
              <th>Mode</th>
              <th data-sort="amount" class="sortable-th num">Amount ${sortIndicator('amount')}</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;

  wire(mount);
}

function wire(mount) {
  mount.querySelector('#exp-add')?.addEventListener('click', () => openExpenseDrawer());

  const search = mount.querySelector('#exp-search');
  search?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => {
      ui.query = v;
      renderExpenses(mount);
      mount.querySelector('#exp-search')?.focus();
    }, 220);
  });

  mount.querySelector('#exp-from')?.addEventListener('change', (e) => { ui.from = e.target.value; renderExpenses(mount); });
  mount.querySelector('#exp-to')?.addEventListener('change', (e) => { ui.to = e.target.value; renderExpenses(mount); });
  mount.querySelector('#exp-clear')?.addEventListener('click', () => {
    ui.query = ''; ui.from = ''; ui.to = ''; ui.category = '';
    renderExpenses(mount);
  });

  mount.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => { ui.category = b.dataset.cat; renderExpenses(mount); }));

  mount.querySelectorAll('[data-sort]').forEach((th) =>
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (ui.sortBy === key) ui.dir = ui.dir === 'asc' ? 'desc' : 'asc';
      else { ui.sortBy = key; ui.dir = key === 'date' ? 'desc' : 'asc'; }
      renderExpenses(mount);
    }));

  mount.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const exp = getState().expenses.find((x) => x.id === b.dataset.edit);
      if (exp) openExpenseDrawer(exp);
    }));

  mount.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      const exp = getState().expenses.find((x) => x.id === b.dataset.del);
      if (!exp) return;
      const ok = await confirmDialog({
        title: 'Delete expense?',
        message: `${formatINR(exp.amount)} · ${getCategory(exp.category).label} · ${vendorName(exp.vendorId)}. This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (ok) await saveExpense('delete', { id: exp.id });
    }));
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}
function escName(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escName(s).replace(/"/g, '&quot;');
}
