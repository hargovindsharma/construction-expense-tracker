// netlify/functions/_shared.js
// Small helpers shared by the write functions. Kept tiny and dependency-light.
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'expenses';
export const DATA_KEY = 'data.json';

const EMPTY = { vendors: [], expenses: [], seq: { vendor: 0, expense: 0 } };

/** Open the Blobs store. */
export function store() {
  return getStore(STORE_NAME);
}

/** Load the data document, seeding an empty one if absent. */
export async function loadData(s) {
  const data = await s.get(DATA_KEY, { type: 'json' });
  if (!data) return structuredClone(EMPTY);
  // Backfill shape in case an older blob is missing fields.
  return {
    vendors: Array.isArray(data.vendors) ? data.vendors : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    seq: {
      vendor: Number(data.seq?.vendor) || 0,
      expense: Number(data.seq?.expense) || 0,
    },
  };
}

/** Persist the data document. */
export async function saveData(s, data) {
  await s.setJSON(DATA_KEY, data);
}

/** Public projection (never leak internal seq counters). */
export function publicView(data) {
  return { vendors: data.vendors, expenses: data.expenses };
}

/** JSON Response helper. */
export function json(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extra || {}) },
  });
}

/**
 * Verify the PIN header against APP_PIN env var.
 * Returns null when OK, or a ready-to-return 401 Response when not.
 */
export function requirePin(req) {
  const expected = process.env.APP_PIN;
  const got = req.headers.get('x-app-pin');
  if (!expected) {
    return json(500, { error: 'Server not configured (APP_PIN missing)' });
  }
  if (!got || got !== expected) {
    return json(401, { error: 'Invalid PIN' });
  }
  return null;
}
