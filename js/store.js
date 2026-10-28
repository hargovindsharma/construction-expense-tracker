// js/store.js
// Central client state + API access + PIN handling. Views subscribe to changes
// and re-render. Keeps all network/mutation concerns in one place.
import { toast, promptPin } from './ui/components.js';

const API = {
  getData: '/api/get-data',
  saveVendor: '/api/save-vendor',
  addExpense: '/api/add-expense',
  saveSettings: '/api/save-settings',
  restoreData: '/api/restore-data',
};
const PIN_KEY = 'cet_pin';

let state = { vendors: [], expenses: [], settings: { budget: 0, categoryBudgets: {} }, loading: true };
const listeners = new Set();

export function getState() {
  return state;
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn(state);
}
function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

/* ---------- PIN ---------- */
export function getPin() {
  return sessionStorage.getItem(PIN_KEY) || '';
}
export function setPin(v) {
  if (v) sessionStorage.setItem(PIN_KEY, v);
  else sessionStorage.removeItem(PIN_KEY);
  emit();
}
export function hasPin() {
  return !!getPin();
}

/* ---------- helpers ---------- */
export function vendorName(id) {
  const v = state.vendors.find((x) => x.id === id);
  return v ? v.name : 'Unknown';
}

/* ---------- API ---------- */
export async function loadData() {
  setState({ loading: true });
  try {
    const res = await fetch(API.getData);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    setState({
      vendors: data.vendors || [],
      expenses: data.expenses || [],
      settings: data.settings || { budget: 0, categoryBudgets: {} },
      loading: false,
    });
  } catch {
    setState({ loading: false });
    toast('Could not load data. Check your connection.', 'error');
  }
}

async function write(url, body) {
  // Prompt for the PIN at transaction time; re-prompt once on a wrong PIN.
  let message = 'Enter your PIN to save this change.';
  for (let attempt = 0; attempt < 4; attempt++) {
    let pin = getPin();
    if (!pin) {
      pin = await promptPin({ message });
      if (!pin) return { ok: false, cancelled: true }; // user dismissed
      setPin(pin);
    }
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-pin': pin },
        body: JSON.stringify(body),
      });
    } catch {
      toast('Network error. Try again.', 'error');
      return { ok: false };
    }
    if (res.status === 401) {
      setPin('');
      message = 'Wrong PIN. Please try again.';
      continue; // loop re-prompts
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error || 'Save failed.', 'error');
      return { ok: false };
    }
    setState({
      vendors: data.vendors || state.vendors,
      expenses: data.expenses || state.expenses,
      settings: data.settings || state.settings,
    });
    return { ok: true, data };
  }
  toast('Wrong PIN. Change not saved.', 'error');
  return { ok: false };
}

export async function saveExpense(op, expense) {
  const r = await write(API.addExpense, { op, expense });
  if (r.ok && op === 'add') {
    toast(r.data.emailSent ? 'Expense added · email sent' : 'Expense added', r.data.emailSent ? 'success' : 'info');
  } else if (r.ok && op === 'update') toast('Expense updated', 'success');
  else if (r.ok && op === 'delete') toast('Expense deleted', 'success');
  return r;
}

export async function saveVendor(op, vendor) {
  const r = await write(API.saveVendor, { op, vendor });
  if (r.ok) toast(op === 'delete' ? 'Vendor deleted' : op === 'add' ? 'Vendor added' : 'Vendor updated', 'success');
  return r;
}

export async function saveBudget(budget) {
  const r = await write(API.saveSettings, { settings: { budget } });
  if (r.ok) toast('Budget updated', 'success');
  return r;
}

/** Save the per-category budget map { category: amount }. */
export async function saveCategoryBudgets(categoryBudgets) {
  const r = await write(API.saveSettings, { settings: { categoryBudgets } });
  if (r.ok) toast('Category budgets updated', 'success');
  return r;
}

/**
 * Snapshot of the current cloud data for a local JSON backup download.
 * Carries NO secrets (no PIN) and no internal seq counters — just the data the
 * user owns. `exportedAt` is a plain timestamp for the user's reference.
 */
export function exportData() {
  return {
    app: 'construction-expense-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    vendors: state.vendors,
    expenses: state.expenses,
    settings: {
      budget: state.settings?.budget || 0,
      categoryBudgets: state.settings?.categoryBudgets || {},
    },
  };
}

/**
 * Replace all cloud data from a parsed backup document (PIN-gated server-side).
 * This overwrites vendors/expenses/settings for every device.
 */
export async function restoreData(doc) {
  const r = await write(API.restoreData, {
    vendors: doc?.vendors,
    expenses: doc?.expenses,
    settings: doc?.settings,
  });
  if (r.ok) toast('Backup restored', 'success');
  return r;
}
