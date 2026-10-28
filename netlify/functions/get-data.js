// netlify/functions/get-data.js
// GET /api/get-data -> { vendors, expenses }. Reads are open (no PIN).
import { store, loadData, publicView, json } from './_shared.js';

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }
  try {
    const data = await loadData(store());
    return json(200, publicView(data));
  } catch (err) {
    console.error('get-data failed:', err);
    return json(500, { error: 'Could not load data' });
  }
}
