// netlify/functions/save-settings.js
// POST /api/save-settings { settings: { budget?, categoryBudgets? } }
//   -> { vendors, expenses, settings }
// Both fields are optional; whichever is present is validated and merged.
import { store, loadData, saveData, publicView, json, requirePin } from './_shared.js';

/** Validate a category->amount map: plain object, each value finite >= 0. */
function cleanCategoryBudgets(raw) {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null; // invalid
  const out = {};
  for (const [cat, val] of Object.entries(raw)) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return null; // invalid
    if (n > 0) out[String(cat)] = n; // drop zero/blank budgets to keep the map lean
  }
  return out;
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

  const rawBudget = payload?.settings?.budget;
  const hasBudget = rawBudget !== undefined;
  const budget = Number(rawBudget);
  if (hasBudget && (!Number.isFinite(budget) || budget < 0)) {
    return json(400, { error: 'Budget must be a non-negative number' });
  }

  const categoryBudgets = cleanCategoryBudgets(payload?.settings?.categoryBudgets);
  if (categoryBudgets === null) {
    return json(400, { error: 'Category budgets must be non-negative numbers' });
  }

  if (!hasBudget && categoryBudgets === undefined) {
    return json(400, { error: 'Nothing to save' });
  }

  try {
    const s = store();
    const data = await loadData(s);
    data.settings = { ...data.settings };
    if (hasBudget) data.settings.budget = budget;
    if (categoryBudgets !== undefined) data.settings.categoryBudgets = categoryBudgets;
    await saveData(s, data);
    return json(200, publicView(data));
  } catch (err) {
    console.error('save-settings failed:', err);
    return json(500, { error: 'Could not save settings' });
  }
}
