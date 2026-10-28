// netlify/functions/restore-data.js
// POST /api/restore-data { vendors, expenses, settings } -> { vendors, expenses, settings }
// PIN-gated. Replaces the stored vendors/expenses/settings WHOLESALE from a backup
// document (see Settings "Download backup") and resets the seq counters past the
// highest imported id so new adds never collide. The blob stays authoritative and
// multi-device: a restore on one device is seen by all others on next load.
import { store, loadData, saveData, publicView, json, requirePin } from './_shared.js';

const VALID_MODES = ['cash', 'UPI', 'bank', 'Cash', 'Bank', 'Online', 'Other'];
const VALID_RATE_TYPES = ['per_sqft', 'lumpsum', 'daily', 'hourly'];

function cleanVendor(v) {
  return {
    id: String(v.id || '').trim(),
    name: String(v.name || '').trim(),
    category: String(v.category || '').trim(),
    phone: String(v.phone || '').trim(),
    rateType: VALID_RATE_TYPES.includes(v.rateType) ? v.rateType : 'lumpsum',
    rateValue: Number(v.rateValue) || 0,
    agreedTotal: Number(v.agreedTotal) || 0,
    notes: String(v.notes || '').trim(),
    status: v.status === 'done' ? 'done' : 'active',
  };
}

function cleanExpense(e) {
  return {
    id: String(e.id || '').trim(),
    date: String(e.date || '').trim(),
    vendorId: String(e.vendorId || '').trim(),
    amount: Number(e.amount) || 0,
    category: String(e.category || '').trim(),
    description: String(e.description || '').trim(),
    paymentMode: VALID_MODES.includes(e.paymentMode) ? e.paymentMode : 'UPI',
    reference: String(e.reference || '').trim(),
    createdAt: String(e.createdAt || '').trim() || new Date().toISOString(),
  };
}

function cleanCategoryBudgets(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [cat, val] of Object.entries(raw)) {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) out[String(cat)] = n;
  }
  return out;
}

/** Highest numeric suffix in `prefix_<n>` ids, so seq resumes past the import. */
function maxSeq(items, prefix) {
  let max = 0;
  for (const it of items) {
    const m = new RegExp(`^${prefix}_(\\d+)$`).exec(it.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const unauthorized = requirePin(req);
  if (unauthorized) return unauthorized;

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { vendors, expenses, settings } = payload || {};
  if (!Array.isArray(vendors) || !Array.isArray(expenses)) {
    return json(400, { error: 'Backup must contain vendors[] and expenses[]' });
  }

  try {
    const s = store();
    const data = await loadData(s); // seeds shape; we overwrite the content below

    data.vendors = vendors.map(cleanVendor).filter((v) => v.id && v.name);
    data.expenses = expenses.map(cleanExpense).filter((e) => e.id);
    data.settings = {
      budget: Number(settings?.budget) || 0,
      categoryBudgets: cleanCategoryBudgets(settings?.categoryBudgets),
    };
    data.seq = {
      vendor: maxSeq(data.vendors, 'v'),
      expense: maxSeq(data.expenses, 'e'),
    };

    await saveData(s, data);
    return json(200, publicView(data));
  } catch (err) {
    console.error('restore-data failed:', err);
    return json(500, { error: 'Could not restore data' });
  }
}
