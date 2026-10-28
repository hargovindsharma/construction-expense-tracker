// js/lib/calc.js
// Pure, framework-free logic for the Construction Expense Tracker.
// No DOM, no network — this is the unit-tested core (see tests/calc.test.js).
// Usable both in the browser (ES module) and in Node functions / Vitest.

/** Format a number as Indian Rupees, e.g. 123456 -> "₹1,23,456". */
export function formatINR(n) {
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Sum of all expense amounts (FR-9). */
export function totalSpent(expenses) {
  return (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/**
 * Sum of expenses in the same calendar month as `ref` (FR-10).
 * `ref` defaults to a date injected by the caller; tests pass a fixed date.
 * Expense dates are "YYYY-MM-DD" strings.
 */
export function spentThisMonth(expenses, ref) {
  const refDate = ref instanceof Date ? ref : new Date(ref);
  const y = refDate.getFullYear();
  const m = refDate.getMonth(); // 0-11
  return (expenses || []).reduce((sum, e) => {
    if (!e.date) return sum;
    const d = new Date(e.date + 'T00:00:00');
    if (d.getFullYear() === y && d.getMonth() === m) {
      return sum + (Number(e.amount) || 0);
    }
    return sum;
  }, 0);
}

/** Total paid to a specific vendor across all expenses. */
export function vendorPaid(expenses, vendorId) {
  return (expenses || [])
    .filter((e) => e.vendorId === vendorId)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Remaining balance for a lumpsum vendor: max(agreed - paid, 0) (FR-12). */
export function lumpsumBalance(vendor, paid) {
  if (!vendor || vendor.rateType !== 'lumpsum') return 0;
  const agreed = Number(vendor.agreedTotal) || 0;
  return Math.max(agreed - (Number(paid) || 0), 0);
}

/** Percent complete for a lumpsum vendor: min(paid/agreed, 1) * 100. */
export function percentComplete(vendor, paid) {
  if (!vendor || vendor.rateType !== 'lumpsum') return 0;
  const agreed = Number(vendor.agreedTotal) || 0;
  if (agreed <= 0) return 0;
  return Math.min((Number(paid) || 0) / agreed, 1) * 100;
}

/** Sum of lumpsum balances across all vendors (FR-12 outstanding). */
export function outstandingTotal(vendors, expenses) {
  return (vendors || []).reduce((sum, v) => {
    if (v.rateType !== 'lumpsum') return sum;
    const paid = vendorPaid(expenses, v.id);
    return sum + lumpsumBalance(v, paid);
  }, 0);
}

/** Group expenses by category, returning { category: totalAmount } (FR-13). */
export function categoryTotals(expenses) {
  const out = {};
  for (const e of expenses || []) {
    const cat = e.category || 'Uncategorized';
    out[cat] = (out[cat] || 0) + (Number(e.amount) || 0);
  }
  return out;
}

/**
 * Newest-first list of the last `n` expenses.
 * Sorts by createdAt (ISO) when present, else by date, else insertion order.
 */
export function lastN(expenses, n) {
  const list = [...(expenses || [])];
  list.sort((a, b) => {
    const ka = a.createdAt || a.date || '';
    const kb = b.createdAt || b.date || '';
    return kb < ka ? -1 : kb > ka ? 1 : 0;
  });
  return list.slice(0, n);
}

/** Generate the next id for a prefix, returning the id and the new counter. */
export function nextId(prefix, seq) {
  const next = (Number(seq) || 0) + 1;
  return { id: `${prefix}_${next}`, seq: next };
}

/** Escape text for safe insertion into HTML (email + DOM strings). */
export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the HTML email body for a newly added expense (FR-15).
 * @param {object} p
 * @param {object} p.expense   the new expense
 * @param {object} p.vendor    the vendor for that expense (may be undefined)
 * @param {object} p.snapshot  { total, month, vendorCount, outstanding } numbers
 * @param {Array}  p.last5     up to 5 expenses, newest first
 * @param {function} [p.vendorName] (id) => name resolver for the last5 table
 */
export function buildEmailHtml({ expense, vendor, snapshot, last5, vendorName }) {
  const nameOf = vendorName || (() => '');
  const vName = vendor ? vendor.name : nameOf(expense.vendorId) || 'Unknown';

  const rows = (last5 || [])
    .map(
      (e) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(e.date)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(
          nameOf(e.vendorId) || e.vendorId || ''
        )}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(
          e.category || ''
        )}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${formatINR(
          e.amount
        )}</td>
      </tr>`
    )
    .join('');

  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#222;max-width:560px;">
    <h2 style="margin:0 0 4px;">🏗️ New expense — ${formatINR(expense.amount)}</h2>
    <p style="margin:0 0 16px;color:#555;">
      ${escapeHtml(vName)} · ${escapeHtml(expense.category || '')} ·
      ${escapeHtml(expense.date)} · ${escapeHtml(expense.paymentMode || '')}
      ${expense.description ? '<br>' + escapeHtml(expense.description) : ''}
    </p>

    <table style="border-collapse:collapse;margin:0 0 16px;width:100%;background:#f7f7f8;border-radius:8px;">
      <tr>
        <td style="padding:10px 12px;">Total spent</td>
        <td style="padding:10px 12px;text-align:right;"><b>${formatINR(snapshot.total)}</b></td>
        <td style="padding:10px 12px;">This month</td>
        <td style="padding:10px 12px;text-align:right;"><b>${formatINR(snapshot.month)}</b></td>
      </tr>
      <tr>
        <td style="padding:10px 12px;">Vendors</td>
        <td style="padding:10px 12px;text-align:right;"><b>${snapshot.vendorCount}</b></td>
        <td style="padding:10px 12px;">Outstanding</td>
        <td style="padding:10px 12px;text-align:right;"><b>${formatINR(
          snapshot.outstanding
        )}</b></td>
      </tr>
    </table>

    <h3 style="margin:0 0 8px;">Last ${Math.min((last5 || []).length, 5)} entries</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead>
        <tr style="text-align:left;color:#666;">
          <th style="padding:6px 10px;">Date</th>
          <th style="padding:6px 10px;">Vendor</th>
          <th style="padding:6px 10px;">Category</th>
          <th style="padding:6px 10px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="margin:16px 0 0;color:#999;font-size:12px;">
      Sent automatically by Construction Expense Tracker.
    </p>
  </div>`;
}
