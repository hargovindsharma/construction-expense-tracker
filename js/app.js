// js/app.js — UI controller for the Construction Expense Tracker.
// Fetches central data, renders the dashboard, and submits writes through the
// Netlify functions. Pure calculations live in lib/calc.js (shared + unit-tested).
import {
  formatINR,
  totalSpent,
  spentThisMonth,
  vendorPaid,
  lumpsumBalance,
  percentComplete,
  outstandingTotal,
  categoryTotals,
} from './lib/calc.js';

const API = {
  getData: '/api/get-data',
  saveVendor: '/api/save-vendor',
  addExpense: '/api/add-expense',
};
const PIN_KEY = 'cet_pin';

let state = { vendors: [], expenses: [] };

/* ---------- small DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const rateLabel = (v) => {
  if (v.rateType === 'lumpsum') return 'Lumpsum';
  if (v.rateType === 'per_sqft') return `${formatINR(v.rateValue)}/sqft`;
  if (v.rateType === 'daily') return `${formatINR(v.rateValue)}/day`;
  if (v.rateType === 'hourly') return `${formatINR(v.rateValue)}/hr`;
  return '—';
};
const vendorName = (id) => {
  const v = state.vendors.find((x) => x.id === id);
  return v ? v.name : 'Unknown';
};

function showMessage(text, kind = 'info', autoHide = true) {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${kind}`;
  el.hidden = false;
  if (autoHide) setTimeout(() => (el.hidden = true), 4000);
}

/* ---------- PIN handling ---------- */
function getPin() {
  return sessionStorage.getItem(PIN_KEY) || $('pin').value.trim();
}
function setPinState() {
  const pin = sessionStorage.getItem(PIN_KEY);
  const el = $('pin-state');
  if (pin) { el.textContent = '✓'; el.className = 'pin-state ok'; }
  else { el.textContent = ''; el.className = 'pin-state'; }
}
$('pin').addEventListener('change', () => {
  const v = $('pin').value.trim();
  if (v) sessionStorage.setItem(PIN_KEY, v);
  else sessionStorage.removeItem(PIN_KEY);
  setPinState();
});

/* ---------- API ---------- */
async function loadData() {
  try {
    const res = await fetch(API.getData);
    if (!res.ok) throw new Error('load failed');
    state = await res.json();
    renderAll();
  } catch {
    showMessage('Could not load data. Check your connection.', 'error', false);
  }
}

async function postWrite(url, body) {
  const pin = getPin();
  if (!pin) {
    showMessage('Enter your PIN (top right) to save.', 'error');
    $('pin').focus();
    return null;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-pin': pin },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    sessionStorage.removeItem(PIN_KEY);
    setPinState();
    showMessage('Wrong PIN. Please re-enter.', 'error');
    $('pin').focus();
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showMessage(data.error || 'Save failed.', 'error');
    return null;
  }
  return data;
}

/* ---------- Rendering ---------- */
function renderAll() {
  renderKpis();
  renderVendorOptions();
  renderVendorTable();
  renderCategoryBars();
  renderExpenseTable();
}

function renderKpis() {
  $('kpi-total').textContent = formatINR(totalSpent(state.expenses));
  $('kpi-month').textContent = formatINR(spentThisMonth(state.expenses, new Date()));
  $('kpi-vendors').textContent = String(state.vendors.length);
  $('kpi-outstanding').textContent = formatINR(
    outstandingTotal(state.vendors, state.expenses)
  );
}

function renderVendorOptions() {
  const sel = $('exp-vendor');
  const filter = $('filter-vendor');
  const current = sel.value;
  const currentFilter = filter.value;
  const opts = state.vendors
    .map((v) => `<option value="${v.id}">${escape(v.name)} — ${escape(v.category)}</option>`)
    .join('');
  sel.innerHTML = opts || '<option value="">Add a vendor first</option>';
  filter.innerHTML =
    '<option value="">All vendors</option>' +
    state.vendors.map((v) => `<option value="${v.id}">${escape(v.name)}</option>`).join('');
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  if ([...filter.options].some((o) => o.value === currentFilter)) filter.value = currentFilter;
}

function renderVendorTable() {
  const tbody = $('vendor-table').querySelector('tbody');
  const empty = $('vendor-empty');
  if (!state.vendors.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = state.vendors
    .map((v) => {
      const paid = vendorPaid(state.expenses, v.id);
      const isLump = v.rateType === 'lumpsum';
      const bal = isLump ? lumpsumBalance(v, paid) : 0;
      const pct = isLump ? percentComplete(v, paid) : 0;
      const progress = isLump
        ? `<div class="progress"><span style="width:${pct.toFixed(0)}%"></span></div>`
        : '—';
      const statusBadge =
        v.status === 'done' ? '<span class="badge done">done</span>' : '';
      return `<tr>
        <td>${escape(v.name)} ${statusBadge}</td>
        <td>${escape(v.category)}</td>
        <td>${rateLabel(v)}</td>
        <td>${isLump ? formatINR(v.agreedTotal) : '—'}</td>
        <td>${formatINR(paid)}</td>
        <td>${isLump ? formatINR(bal) : '—'}</td>
        <td>${progress}</td>
        <td>
          <button class="btn link" data-edit-vendor="${v.id}">Edit</button>
          <button class="btn link danger" data-del-vendor="${v.id}">Del</button>
        </td>
      </tr>`;
    })
    .join('');
}

function renderCategoryBars() {
  const wrap = $('category-bars');
  const empty = $('category-empty');
  const totals = categoryTotals(state.expenses);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    wrap.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const max = Math.max(...entries.map(([, v]) => v));
  wrap.innerHTML = entries
    .map(([cat, amt]) => {
      const pct = max > 0 ? (amt / max) * 100 : 0;
      return `<div class="bar-row">
        <span class="bar-label" title="${escape(cat)}">${escape(cat)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
        <span class="bar-amount">${formatINR(amt)}</span>
      </div>`;
    })
    .join('');
}

function renderExpenseTable() {
  const tbody = $('expense-table').querySelector('tbody');
  const empty = $('expense-empty');
  const filter = $('filter-vendor').value;
  let rows = [...state.expenses];
  if (filter) rows = rows.filter((e) => e.vendorId === filter);
  rows.sort((a, b) => {
    const ka = a.createdAt || a.date || '';
    const kb = b.createdAt || b.date || '';
    return kb < ka ? -1 : kb > ka ? 1 : 0;
  });
  if (!rows.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = rows
    .map(
      (e) => `<tr>
        <td>${escape(e.date)}</td>
        <td>${escape(vendorName(e.vendorId))}</td>
        <td>${escape(e.category || '')}</td>
        <td>${escape(e.paymentMode || '')}</td>
        <td class="right">${formatINR(e.amount)}</td>
        <td>
          <button class="btn link" data-edit-exp="${e.id}">Edit</button>
          <button class="btn link danger" data-del-exp="${e.id}">Del</button>
        </td>
      </tr>`
    )
    .join('');
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Expense form ---------- */
const expenseForm = $('expense-form');
$('exp-vendor').addEventListener('change', () => {
  // auto-fill category from the chosen vendor if the field is empty
  const v = state.vendors.find((x) => x.id === $('exp-vendor').value);
  if (v && !$('exp-category').value.trim()) $('exp-category').value = v.category;
});

expenseForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = $('exp-id').value;
  const expense = {
    id: id || undefined,
    vendorId: $('exp-vendor').value,
    amount: Number($('exp-amount').value),
    date: $('exp-date').value,
    category: $('exp-category').value.trim(),
    paymentMode: $('exp-mode').value,
    description: $('exp-desc').value.trim(),
  };
  if (!expense.vendorId) return showMessage('Choose a vendor.', 'error');
  if (!(expense.amount > 0)) return showMessage('Amount must be greater than 0.', 'error');
  if (!expense.date) return showMessage('Pick a date.', 'error');

  const op = id ? 'update' : 'add';
  const data = await postWrite(API.addExpense, { op, expense });
  if (!data) return;
  state = { vendors: data.vendors, expenses: data.expenses };
  renderAll();
  resetExpenseForm();
  if (op === 'add') {
    showMessage(
      data.emailSent ? 'Expense added · email sent ✓' : 'Expense added · (email not sent)',
      data.emailSent ? 'success' : 'info'
    );
  } else {
    showMessage('Expense updated.', 'success');
  }
});

function resetExpenseForm() {
  expenseForm.reset();
  $('exp-id').value = '';
  $('exp-submit').textContent = 'Add Expense';
  $('exp-cancel').hidden = true;
  setToday();
}
$('exp-cancel').addEventListener('click', resetExpenseForm);

function editExpense(id) {
  const e = state.expenses.find((x) => x.id === id);
  if (!e) return;
  $('exp-id').value = e.id;
  $('exp-vendor').value = e.vendorId;
  $('exp-amount').value = e.amount;
  $('exp-date').value = e.date;
  $('exp-category').value = e.category || '';
  $('exp-mode').value = e.paymentMode || 'UPI';
  $('exp-desc').value = e.description || '';
  $('exp-submit').textContent = 'Save changes';
  $('exp-cancel').hidden = false;
  expenseForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- Vendor form ---------- */
const vendorForm = $('vendor-form');
vendorForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = $('ven-id').value;
  const vendor = {
    id: id || undefined,
    name: $('ven-name').value.trim(),
    category: $('ven-category').value.trim(),
    rateType: $('ven-ratetype').value,
    rateValue: Number($('ven-ratevalue').value) || 0,
    agreedTotal: Number($('ven-agreed').value) || 0,
    phone: $('ven-phone').value.trim(),
    status: $('ven-status').value,
    notes: $('ven-notes').value.trim(),
  };
  if (!vendor.name || !vendor.category)
    return showMessage('Vendor name and category are required.', 'error');

  const op = id ? 'update' : 'add';
  const data = await postWrite(API.saveVendor, { op, vendor });
  if (!data) return;
  state = { vendors: data.vendors, expenses: data.expenses };
  renderAll();
  resetVendorForm();
  showMessage(op === 'add' ? 'Vendor added.' : 'Vendor updated.', 'success');
});

function resetVendorForm() {
  vendorForm.reset();
  $('ven-id').value = '';
  $('ven-submit').textContent = 'Add Vendor';
  $('ven-cancel').hidden = true;
}
$('ven-cancel').addEventListener('click', resetVendorForm);

function editVendor(id) {
  const v = state.vendors.find((x) => x.id === id);
  if (!v) return;
  $('vendor-panel').open = true;
  $('ven-id').value = v.id;
  $('ven-name').value = v.name;
  $('ven-category').value = v.category;
  $('ven-ratetype').value = v.rateType;
  $('ven-ratevalue').value = v.rateValue || 0;
  $('ven-agreed').value = v.agreedTotal || 0;
  $('ven-phone').value = v.phone || '';
  $('ven-status').value = v.status || 'active';
  $('ven-notes').value = v.notes || '';
  $('ven-submit').textContent = 'Save changes';
  $('ven-cancel').hidden = false;
  vendorForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteVendor(id) {
  const v = state.vendors.find((x) => x.id === id);
  const hasExpenses = state.expenses.some((e) => e.vendorId === id);
  const warn = hasExpenses
    ? `Delete "${v?.name}"? Its expenses will remain but show as "Unknown".`
    : `Delete "${v?.name}"?`;
  if (!confirm(warn)) return;
  const data = await postWrite(API.saveVendor, { op: 'delete', vendor: { id } });
  if (!data) return;
  state = { vendors: data.vendors, expenses: data.expenses };
  renderAll();
  showMessage('Vendor deleted.', 'success');
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  const data = await postWrite(API.addExpense, { op: 'delete', expense: { id } });
  if (!data) return;
  state = { vendors: data.vendors, expenses: data.expenses };
  renderAll();
  showMessage('Expense deleted.', 'success');
}

/* ---------- Event delegation for table buttons ---------- */
document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLElement)) return;
  if (t.dataset.editExp) editExpense(t.dataset.editExp);
  else if (t.dataset.delExp) deleteExpense(t.dataset.delExp);
  else if (t.dataset.editVendor) editVendor(t.dataset.editVendor);
  else if (t.dataset.delVendor) deleteVendor(t.dataset.delVendor);
});
$('filter-vendor').addEventListener('change', renderExpenseTable);

/* ---------- Init ---------- */
function setToday() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  $('exp-date').value = iso;
}
setToday();
setPinState();
loadData();
