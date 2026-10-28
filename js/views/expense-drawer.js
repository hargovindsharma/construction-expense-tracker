// js/views/expense-drawer.js
// The Add / Edit Expense drawer, shared by the topbar button and the Expenses view.
import { openDrawer, esc, toast } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { CATEGORIES, PAYMENT_MODES } from '../lib/categories.js';
import { getState, saveExpense } from '../store.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Open the drawer. Pass an existing expense to edit, or nothing to add. */
export function openExpenseDrawer(existing = null) {
  const { vendors } = getState();
  const e = existing || {};
  const isEdit = !!existing;

  const vendorOpts = vendors
    .map((v) => `<option value="${v.id}" ${e.vendorId === v.id ? 'selected' : ''}>${esc(v.name)} — ${esc(v.category)}</option>`)
    .join('');

  const catChips = CATEGORIES.map(
    (c) => `
    <label class="chip-radio">
      <input type="radio" name="dr-category" value="${esc(c.id)}" ${e.category === c.id ? 'checked' : ''}>
      <span class="chip" style="--cat:${c.color}">${icon(c.icon, { size: 14 })} ${esc(c.label)}</span>
    </label>`
  ).join('');

  const modeOpts = PAYMENT_MODES.map(
    (m) => `<option value="${m}" ${e.paymentMode === m ? 'selected' : ''}>${m}</option>`
  ).join('');

  const body = `
  <form id="dr-form" class="drawer-form" novalidate>
    <div class="field">
      <label for="dr-amount">Amount (₹)</label>
      <input id="dr-amount" type="number" inputmode="numeric" min="1" step="1"
             value="${e.amount ?? ''}" required autocomplete="off" />
      <small class="field-error" data-err="amount"></small>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="dr-vendor">Vendor</label>
        <select id="dr-vendor" required>${vendorOpts || '<option value="">Add a vendor first</option>'}</select>
      </div>
      <div class="field">
        <label for="dr-date">Date</label>
        <input id="dr-date" type="date" value="${esc(e.date || todayISO())}" required />
      </div>
    </div>

    <div class="field">
      <label>Category / Stage</label>
      <div class="chip-grid">${catChips}</div>
      <small class="field-error" data-err="category"></small>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="dr-mode">Payment mode</label>
        <select id="dr-mode">${modeOpts}</select>
      </div>
      <div class="field">
        <label for="dr-ref">Reference / Txn ID</label>
        <input id="dr-ref" type="text" value="${esc(e.reference || '')}" placeholder="optional — UPI ref, cheque no." autocomplete="off" />
      </div>
    </div>

    <div class="field">
      <label for="dr-desc">Description / Note</label>
      <input id="dr-desc" type="text" value="${esc(e.description || '')}" placeholder="optional" />
    </div>

    <div class="drawer-foot">
      <button type="button" class="btn ghost" data-drawer-close>Cancel</button>
      <button type="submit" class="btn primary" id="dr-submit">
        ${icon(isEdit ? 'check' : 'plus', { size: 16 })} ${isEdit ? 'Save changes' : 'Add Expense'}
      </button>
    </div>
  </form>`;

  openDrawer({
    title: isEdit ? 'Edit Expense' : 'Add Expense',
    bodyHtml: body,
    onMount: (root, close) => {
      const form = root.querySelector('#dr-form');
      const amount = root.querySelector('#dr-amount');
      const vendorSel = root.querySelector('#dr-vendor');

      // Auto-pick category from the selected vendor if none chosen yet.
      vendorSel?.addEventListener('change', () => {
        const chosen = root.querySelector('input[name="dr-category"]:checked');
        if (chosen) return;
        const v = getState().vendors.find((x) => x.id === vendorSel.value);
        if (v) {
          const radio = root.querySelector(`input[name="dr-category"][value="${CSS.escape(v.category)}"]`);
          if (radio) radio.checked = true;
        }
      });

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        root.querySelectorAll('.field-error').forEach((n) => (n.textContent = ''));
        const amt = Number(amount.value);
        const category = root.querySelector('input[name="dr-category"]:checked')?.value || '';
        let bad = false;
        if (!(amt > 0)) { setErr(root, 'amount', 'Enter an amount greater than 0'); bad = true; }
        if (!category) { setErr(root, 'category', 'Pick a category'); bad = true; }
        if (!vendorSel.value) { bad = true; toast('Choose a vendor', 'error'); }
        if (bad) return;

        const payload = {
          id: isEdit ? e.id : undefined,
          vendorId: vendorSel.value,
          amount: amt,
          date: root.querySelector('#dr-date').value,
          category,
          paymentMode: root.querySelector('#dr-mode').value,
          description: root.querySelector('#dr-desc').value.trim(),
          reference: root.querySelector('#dr-ref').value.trim(),
        };
        const submit = root.querySelector('#dr-submit');
        submit.disabled = true;
        submit.classList.add('loading');
        const r = await saveExpense(isEdit ? 'update' : 'add', payload);
        submit.disabled = false;
        submit.classList.remove('loading');
        if (r.ok) close();
      });
    },
  });
}

function setErr(root, key, msg) {
  const n = root.querySelector(`[data-err="${key}"]`);
  if (n) n.textContent = msg;
}
