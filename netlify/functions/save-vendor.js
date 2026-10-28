// netlify/functions/save-vendor.js
// POST /api/save-vendor { op: add|update|delete, vendor } -> { vendors, expenses }
import { store, loadData, saveData, publicView, json, requirePin } from './_shared.js';
import { nextId } from '../../js/lib/calc.js';

const VALID_RATE_TYPES = ['per_sqft', 'lumpsum', 'daily', 'hourly'];

function sanitizeVendor(v) {
  return {
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

  const { op, vendor } = payload || {};
  if (!op || !vendor) return json(400, { error: 'Missing op or vendor' });

  try {
    const s = store();
    const data = await loadData(s);

    if (op === 'add') {
      const clean = sanitizeVendor(vendor);
      if (!clean.name || !clean.category) {
        return json(400, { error: 'Vendor name and category are required' });
      }
      const { id, seq } = nextId('v', data.seq.vendor);
      data.seq.vendor = seq;
      data.vendors.push({ id, ...clean });
    } else if (op === 'update') {
      if (!vendor.id) return json(400, { error: 'Vendor id required for update' });
      const idx = data.vendors.findIndex((x) => x.id === vendor.id);
      if (idx === -1) return json(400, { error: 'Vendor not found' });
      const clean = sanitizeVendor(vendor);
      if (!clean.name || !clean.category) {
        return json(400, { error: 'Vendor name and category are required' });
      }
      data.vendors[idx] = { id: vendor.id, ...clean };
    } else if (op === 'delete') {
      if (!vendor.id) return json(400, { error: 'Vendor id required for delete' });
      data.vendors = data.vendors.filter((x) => x.id !== vendor.id);
    } else {
      return json(400, { error: `Unknown op: ${op}` });
    }

    await saveData(s, data);
    return json(200, publicView(data));
  } catch (err) {
    console.error('save-vendor failed:', err);
    return json(500, { error: 'Could not save vendor' });
  }
}
