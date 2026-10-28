// js/views/vendors.js
// Vendor summary + CRUD. Shows paid-to-date per vendor and, for lumpsum vendors,
// the agreed total / balance. All money math comes from calc.js. Vendor schema
// mirrors netlify/functions/save-vendor.js:
//   { id, name, category, phone, rateType, rateValue, agreedTotal, notes, status }
import { vendorPaid, lumpsumBalance, percentComplete, formatINR } from '../lib/calc.js';
import { CATEGORY_IDS, getCategory } from '../lib/categories.js';
import { categoryBadge, confirmDialog, emptyState, openDrawer, esc } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { getState, saveVendor } from '../store.js';

const RATE_TYPES = [
  { id: 'lumpsum', label: 'Lumpsum (fixed total)' },
  { id: 'per_sqft', label: 'Per sq.ft' },
  { id: 'daily', label: 'Daily wage' },
  { id: 'hourly', label: 'Hourly' },
];

export function renderVendors(mount) {
  const s = getState();
  if (s.loading) {
    mount.innerHTML = `<div class="view-head"><h1>Vendors</h1></div><div class="card">Loading…</div>`;
    return;
  }
  const { vendors, expenses } = s;

  const cards = vendors.length
    ? vendors.map((v) => {
        const paid = vendorPaid(expenses, v.id);
        const isLump = v.rateType === 'lumpsum' && Number(v.agreedTotal) > 0;
        const bal = isLump ? lumpsumBalance(v, paid) : null;
        const pct = isLump ? Math.round(percentComplete(v, paid)) : null;
        const rateLine =
          v.rateType === 'per_sqft' && v.rateValue > 0 ? `${formatINR(v.rateValue)}/sqft`
          : v.rateType === 'daily' && v.rateValue > 0 ? `${formatINR(v.rateValue)}/day`
          : v.rateType === 'hourly' && v.rateValue > 0 ? `${formatINR(v.rateValue)}/hr`
          : '';
        return `
        <article class="card vendor-card">
          <div class="vendor-top">
            <div class="vendor-id">
              <h3>${esc(v.name)} ${v.status === 'done' ? '<span class="pill pill-done">cleared</span>' : ''}</h3>
              ${categoryBadge(v.category)}
            </div>
            <div class="vendor-actions">
              <button class="icon-btn" data-vedit="${v.id}" aria-label="Edit vendor">${icon('edit', { size: 16 })}</button>
              <button class="icon-btn danger" data-vdel="${v.id}" aria-label="Delete vendor">${icon('trash', { size: 16 })}</button>
            </div>
          </div>
          <div class="vendor-stats">
            <div><span class="stat-label">Paid</span><span class="stat-val">${formatINR(paid)}</span></div>
            ${isLump ? `
              <div><span class="stat-label">Agreed</span><span class="stat-val">${formatINR(v.agreedTotal)}</span></div>
              <div><span class="stat-label">Balance</span><span class="stat-val ${bal > 0 ? 'neg' : ''}">${formatINR(bal)}</span></div>` : ''}
            ${rateLine ? `<div><span class="stat-label">Rate</span><span class="stat-val">${rateLine}</span></div>` : ''}
          </div>
          ${pct != null ? `<div class="vendor-bar"><span style="width:${Math.min(100, pct)}%"></span></div><span class="vendor-pct">${pct}% of agreed paid</span>` : ''}
          ${v.notes ? `<p class="vendor-note">${esc(v.notes)}</p>` : ''}
        </article>`;
      }).join('')
    : emptyState({ iconName: 'users', title: 'No vendors yet', text: 'Add a vendor to start tracking payments by trade.', ctaId: 'vempty-add', ctaLabel: 'Add Vendor' });

  mount.innerHTML = `
    <div class="view-head">
      <div><h1>Vendors</h1><p class="view-sub">${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}</p></div>
      <button class="btn primary" id="vendor-add">${icon('plus', { size: 16 })} Add Vendor</button>
    </div>
    <div class="vendor-grid">${cards}</div>`;

  mount.querySelector('#vendor-add')?.addEventListener('click', () => openVendorDrawer());
  mount.querySelector('#vempty-add')?.addEventListener('click', () => openVendorDrawer());
  mount.querySelectorAll('[data-vedit]').forEach((b) =>
    b.addEventListener('click', () => {
      const v = getState().vendors.find((x) => x.id === b.dataset.vedit);
      if (v) openVendorDrawer(v);
    }));
  mount.querySelectorAll('[data-vdel]').forEach((b) =>
    b.addEventListener('click', async () => {
      const v = getState().vendors.find((x) => x.id === b.dataset.vdel);
      if (!v) return;
      const paid = vendorPaid(getState().expenses, v.id);
      const ok = await confirmDialog({
        title: 'Delete vendor?',
        message: paid > 0
          ? `${v.name} has ${formatINR(paid)} in recorded expenses. Those expenses stay but will show "Unknown". Continue?`
          : `Delete ${v.name}? This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (ok) await saveVendor('delete', { id: v.id });
    }));
}

function openVendorDrawer(existing = null) {
  const v = existing || {};
  const isEdit = !!existing;
  const catOpts = CATEGORY_IDS.map((id) => {
    const c = getCategory(id);
    return `<option value="${esc(id)}" ${v.category === id ? 'selected' : ''}>${esc(c.label)}</option>`;
  }).join('');
  const rateOpts = RATE_TYPES.map((r) => `<option value="${r.id}" ${v.rateType === r.id ? 'selected' : ''}>${r.label}</option>`).join('');

  const body = `
  <form id="v-form" class="drawer-form" novalidate>
    <div class="field">
      <label for="v-name">Vendor name</label>
      <input id="v-name" type="text" value="${esc(v.name || '')}" required autocomplete="off" />
      <small class="field-error" data-err="name"></small>
    </div>
    <div class="field">
      <label for="v-cat">Trade / Category</label>
      <select id="v-cat">${catOpts}</select>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="v-ratetype">Rate type</label>
        <select id="v-ratetype">${rateOpts}</select>
      </div>
      <div class="field">
        <label for="v-rateval">Rate (₹)</label>
        <input id="v-rateval" type="number" min="0" step="1" value="${v.rateValue ?? ''}" placeholder="optional" />
      </div>
    </div>
    <div class="field">
      <label for="v-agreed">Agreed total — lumpsum (₹)</label>
      <input id="v-agreed" type="number" min="0" step="1" value="${v.agreedTotal ?? ''}" placeholder="for lumpsum vendors" />
    </div>
    <div class="field">
      <label for="v-phone">Phone</label>
      <input id="v-phone" type="text" value="${esc(v.phone || '')}" placeholder="optional" />
    </div>
    <div class="field">
      <label for="v-notes">Notes</label>
      <input id="v-notes" type="text" value="${esc(v.notes || '')}" placeholder="optional" />
    </div>
    <div class="field">
      <label class="check"><input id="v-done" type="checkbox" ${v.status === 'done' ? 'checked' : ''}> Account cleared / settled</label>
    </div>
    <div class="drawer-foot">
      <button type="button" class="btn ghost" data-drawer-close>Cancel</button>
      <button type="submit" class="btn primary" id="v-submit">${icon(isEdit ? 'check' : 'plus', { size: 16 })} ${isEdit ? 'Save changes' : 'Add Vendor'}</button>
    </div>
  </form>`;

  openDrawer({
    title: isEdit ? 'Edit Vendor' : 'Add Vendor',
    bodyHtml: body,
    onMount: (root, close) => {
      root.querySelector('#v-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = root.querySelector('#v-name').value.trim();
        if (!name) { root.querySelector('[data-err="name"]').textContent = 'Enter a vendor name'; return; }
        const payload = {
          id: isEdit ? v.id : undefined,
          name,
          category: root.querySelector('#v-cat').value,
          rateType: root.querySelector('#v-ratetype').value,
          rateValue: Number(root.querySelector('#v-rateval').value) || 0,
          agreedTotal: Number(root.querySelector('#v-agreed').value) || 0,
          phone: root.querySelector('#v-phone').value.trim(),
          notes: root.querySelector('#v-notes').value.trim(),
          status: root.querySelector('#v-done').checked ? 'done' : 'active',
        };
        const btn = root.querySelector('#v-submit');
        btn.disabled = true; btn.classList.add('loading');
        const r = await saveVendor(isEdit ? 'update' : 'add', payload);
        btn.disabled = false; btn.classList.remove('loading');
        if (r.ok) close();
      });
    },
  });
}
