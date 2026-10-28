// js/views/settings.js
// Project budget, PIN entry, and theme preference. Budget persists to the blob
// via the store; PIN lives in sessionStorage; theme in localStorage.
import { totalSpent, budgetRemaining, budgetUsedPct, formatINR, categoryBudgetRows } from '../lib/calc.js';
import { esc, toast, confirmDialog } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { CATEGORIES, getCategory } from '../lib/categories.js';
import {
  getState,
  saveBudget,
  saveCategoryBudgets,
  getPin,
  setPin,
  hasPin,
  exportData,
  restoreData,
} from '../store.js';
import { getTheme, setTheme } from '../app.js';

export function renderSettings(mount) {
  const s = getState();
  const budget = s.settings?.budget || 0;
  const categoryBudgets = s.settings?.categoryBudgets || {};
  const spent = totalSpent(s.expenses);
  const remaining = budgetRemaining(budget, s.expenses);
  const pct = Math.round(budgetUsedPct(budget, s.expenses));
  const theme = getTheme();

  // Rows keyed by category id so saved budgets display even for categories with
  // no spend yet; spend figures come from categoryBudgetRows.
  const spendByCat = {};
  for (const r of categoryBudgetRows(s.expenses, categoryBudgets)) spendByCat[r.category] = r.spent;
  const catBudgetRows = CATEGORIES.map((c) => {
    const bval = Number(categoryBudgets[c.id]) || 0;
    const sp = Number(spendByCat[c.id]) || 0;
    return `
      <div class="catbud-row">
        <label class="catbud-label" for="cb-${esc(c.id)}" style="--cat:${c.color}">
          ${icon(c.icon, { size: 15 })} ${esc(c.label)}
          <span class="catbud-spent">${formatINR(sp)} spent</span>
        </label>
        <input id="cb-${esc(c.id)}" class="catbud-input" type="number" min="0" step="1000"
               data-cat="${esc(c.id)}" value="${bval || ''}" placeholder="no budget" />
      </div>`;
  }).join('');

  mount.innerHTML = `
    <div class="view-head"><div><h1>Settings</h1><p class="view-sub">Budget, access, and appearance</p></div></div>

    <section class="card settings-card">
      <div class="card-head"><h2>${icon('piggy', { size: 18 })} Project Budget</h2></div>
      <p class="muted">Set your total project budget to track remaining funds on the dashboard.</p>
      <form id="budget-form" class="inline-form">
        <div class="field">
          <label for="set-budget">Total budget (₹)</label>
          <input id="set-budget" type="number" min="0" step="1000" value="${budget || ''}" placeholder="e.g. 2000000" />
        </div>
        <button type="submit" class="btn primary" id="budget-save">${icon('check', { size: 16 })} Save budget</button>
      </form>
      ${budget > 0 ? `
        <div class="budget-readout">
          <div><span class="stat-label">Spent</span><span class="stat-val">${formatINR(spent)}</span></div>
          <div><span class="stat-label">${remaining < 0 ? 'Over by' : 'Remaining'}</span><span class="stat-val ${remaining < 0 ? 'neg' : 'pos'}">${formatINR(Math.abs(remaining))}</span></div>
          <div class="budget-bar"><span class="${remaining < 0 ? 'over' : ''}" style="width:${pct}%"></span></div>
          <span class="muted">${pct}% of budget used</span>
        </div>` : ''}
    </section>

    <section class="card settings-card">
      <div class="card-head"><h2>${icon('piggy', { size: 18 })} Stage / Category Budgets</h2></div>
      <p class="muted">Set a target per category (your stages). The dashboard shows a progress bar for each — green, amber near the limit, red when overspent. Leave blank for no target.</p>
      <form id="catbud-form">
        <div class="catbud-grid">${catBudgetRows}</div>
        <div class="inline-form" style="margin-top:14px;">
          <button type="submit" class="btn primary" id="catbud-save">${icon('check', { size: 16 })} Save category budgets</button>
        </div>
      </form>
    </section>

    <section class="card settings-card">
      <div class="card-head"><h2>${icon('settings', { size: 18 })} Access PIN</h2></div>
      <p class="muted">Your PIN is asked for whenever you add, edit, or delete. Viewing is always open. Remember it here to skip the prompt for the rest of this browser session.</p>
      <form id="pin-form" class="inline-form">
        <div class="field">
          <label for="set-pin">PIN</label>
          <input id="set-pin" type="password" inputmode="numeric" value="${esc(getPin())}" placeholder="Enter PIN" autocomplete="off" />
        </div>
        <button type="submit" class="btn primary">${hasPin() ? 'Update' : 'Remember'}</button>
        ${hasPin() ? `<button type="button" class="btn ghost" id="pin-clear">Forget</button>` : ''}
      </form>
      <span class="pin-state ${hasPin() ? 'on' : 'off'}">${hasPin() ? '● Remembered — no prompt this session' : '○ Not remembered — you’ll be asked on each change'}</span>
    </section>

    <section class="card settings-card">
      <div class="card-head"><h2>${icon('download', { size: 18 })} Data Safety</h2></div>
      <p class="muted">Download a full backup of your data as a JSON file, or restore from one. Restore <strong>replaces all cloud data for every device</strong>, so keep a backup first.</p>
      <div class="inline-form">
        <button type="button" class="btn primary" id="data-export">${icon('download', { size: 16 })} Download backup</button>
        <button type="button" class="btn ghost" id="data-restore-btn">${icon('upload', { size: 16 })} Restore from file…</button>
        <input type="file" id="data-restore-file" accept="application/json,.json" hidden />
      </div>
    </section>

    <section class="card settings-card">
      <div class="card-head"><h2>${icon('sun', { size: 18 })} Appearance</h2></div>
      <p class="muted">Choose how the app looks. "System" follows your device setting.</p>
      <div class="theme-toggle" role="radiogroup" aria-label="Theme">
        ${themeBtn('light', 'sun', 'Light', theme)}
        ${themeBtn('dark', 'moon', 'Dark', theme)}
        ${themeBtn('system', 'settings', 'System', theme)}
      </div>
    </section>`;

  mount.querySelector('#budget-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = Number(mount.querySelector('#set-budget').value);
    if (!(val >= 0)) { toast('Enter a valid budget', 'error'); return; }
    const btn = mount.querySelector('#budget-save');
    btn.disabled = true; btn.classList.add('loading');
    await saveBudget(val);
    btn.disabled = false; btn.classList.remove('loading');
  });

  mount.querySelector('#catbud-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const map = {};
    mount.querySelectorAll('.catbud-input').forEach((inp) => {
      const v = Number(inp.value);
      if (v > 0) map[inp.dataset.cat] = v;
    });
    const btn = mount.querySelector('#catbud-save');
    btn.disabled = true; btn.classList.add('loading');
    await saveCategoryBudgets(map);
    btn.disabled = false; btn.classList.remove('loading');
    renderSettings(mount);
  });

  wireDataSafety(mount);

  mount.querySelector('#pin-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = mount.querySelector('#set-pin').value.trim();
    setPin(val);
    toast(val ? 'PIN set for this session' : 'PIN cleared', val ? 'success' : 'info');
    renderSettings(mount);
  });
  mount.querySelector('#pin-clear')?.addEventListener('click', () => {
    setPin('');
    toast('Locked — view only', 'info');
    renderSettings(mount);
  });

  mount.querySelectorAll('[data-theme-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      setTheme(b.dataset.themeOpt);
      renderSettings(mount);
    }));
}

function themeBtn(value, iconName, label, current) {
  const active = current === value;
  return `<button class="theme-opt ${active ? 'active' : ''}" data-theme-opt="${value}"
            role="radio" aria-checked="${active}">${icon(iconName, { size: 16 })} ${label}</button>`;
}

/** Wire the Data Safety card: download backup JSON + restore from a chosen file. */
function wireDataSafety(mount) {
  mount.querySelector('#data-export')?.addEventListener('click', () => {
    const doc = exportData();
    const stamp = doc.exportedAt.slice(0, 10);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', 'success');
  });

  const fileInput = mount.querySelector('#data-restore-file');
  mount.querySelector('#data-restore-btn')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    let doc;
    try {
      doc = JSON.parse(await file.text());
    } catch {
      toast('That file is not valid JSON', 'error');
      return;
    }
    if (!Array.isArray(doc?.vendors) || !Array.isArray(doc?.expenses)) {
      toast('Backup is missing vendors or expenses', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: 'Restore this backup?',
      message: `This replaces ALL current cloud data (${doc.vendors.length} vendors, ${doc.expenses.length} expenses) on every device. This cannot be undone.`,
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    const r = await restoreData(doc);
    if (r.ok) renderSettings(mount);
  });
}
