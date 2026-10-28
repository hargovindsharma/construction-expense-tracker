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
 * `ref` defaults to the current date; tests pass a fixed date for determinism.
 * Expense dates are "YYYY-MM-DD" strings.
 */
export function spentThisMonth(expenses, ref) {
  const refDate = ref instanceof Date ? ref : ref != null ? new Date(ref) : new Date();
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

/** Sum of expenses on the same calendar day as `ref` (defaults to today). */
export function spentToday(expenses, ref) {
  const r = ref instanceof Date ? ref : ref != null ? new Date(ref) : new Date();
  const y = r.getFullYear();
  const m = r.getMonth();
  const d = r.getDate();
  return (expenses || []).reduce((sum, e) => {
    if (!e.date) return sum;
    const dt = new Date(e.date + 'T00:00:00');
    if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) {
      return sum + (Number(e.amount) || 0);
    }
    return sum;
  }, 0);
}

/** Number of recorded transactions. */
export function transactionCount(expenses) {
  return (expenses || []).length;
}

/** Budget minus total spent (may be negative on overspend). */
export function budgetRemaining(budget, expenses) {
  return (Number(budget) || 0) - totalSpent(expenses);
}

/** Percentage of budget consumed, clamped to 0..100. */
export function budgetUsedPct(budget, expenses) {
  const b = Number(budget) || 0;
  if (b <= 0) return 0;
  return Math.min((totalSpent(expenses) / b) * 100, 100);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Totals for the last `months` calendar months ending at `ref` (inclusive),
 * oldest-first. Each entry: { label: 'Oct', year, total }.
 */
export function monthlySeries(expenses, months, ref) {
  const r = ref instanceof Date ? ref : new Date(ref);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(r.getFullYear(), r.getMonth() - i, 1);
    buckets.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), total: 0 });
  }
  for (const e of expenses || []) {
    if (!e.date) continue;
    const dt = new Date(e.date + 'T00:00:00');
    const b = buckets.find((x) => x.y === dt.getFullYear() && x.m === dt.getMonth());
    if (b) b.total += Number(e.amount) || 0;
  }
  return buckets.map(({ label, year, total }) => ({ label, year, total }));
}

/**
 * Current month vs previous month totals and trend.
 * Returns { current, previous, deltaPct, direction: 'up'|'down'|'flat' }.
 */
export function trendVsPrevious(expenses, ref) {
  const r = ref instanceof Date ? ref : new Date(ref);
  const cur = new Date(r.getFullYear(), r.getMonth(), 1);
  const prev = new Date(r.getFullYear(), r.getMonth() - 1, 1);
  const sumMonth = (y, m) =>
    (expenses || []).reduce((s, e) => {
      if (!e.date) return s;
      const dt = new Date(e.date + 'T00:00:00');
      return dt.getFullYear() === y && dt.getMonth() === m ? s + (Number(e.amount) || 0) : s;
    }, 0);
  const current = sumMonth(cur.getFullYear(), cur.getMonth());
  const previous = sumMonth(prev.getFullYear(), prev.getMonth());
  let deltaPct;
  if (previous === 0) deltaPct = current === 0 ? 0 : 100;
  else deltaPct = Math.round(((current - previous) / previous) * 100);
  const direction = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  return { current, previous, deltaPct, direction };
}

/**
 * Total paid to each vendor, as a sorted (largest-first) array.
 * Each entry: { vendorId, name, total }. Used by the vendor-wise bar chart.
 * `vendorName` is an optional (id)=>name resolver; unknown ids fall back to
 * the id string, or 'Unknown' when the expense has no vendorId.
 */
export function vendorTotals(expenses, vendorName) {
  const nameOf = vendorName || (() => '');
  const totals = new Map();
  for (const e of expenses || []) {
    const id = e.vendorId || '';
    totals.set(id, (totals.get(id) || 0) + (Number(e.amount) || 0));
  }
  return [...totals.entries()]
    .map(([vendorId, total]) => ({
      vendorId,
      name: nameOf(vendorId) || vendorId || 'Unknown',
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Category totals as a sorted array with percentages (for the donut). */
export function categoryBreakdown(expenses) {
  const totals = categoryTotals(expenses);
  const grand = totalSpent(expenses);  return Object.entries(totals)
    .map(([category, total]) => ({
      category,
      total,
      pct: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Pure search / filter / sort for the All-Expenses view (keeps logic out of UI).
 * opts: { query, category, from, to, sortBy: 'date'|'amount'|'vendor', dir: 'asc'|'desc', vendorName }
 * `vendorName` optional (id)=>name used for query matching + vendor sort.
 */
export function filterSortExpenses(expenses, opts = {}) {
  const { query = '', category = '', from = '', to = '', sortBy = 'date', dir = 'desc', vendorName } = opts;
  const nameOf = vendorName || (() => '');
  const q = String(query).trim().toLowerCase();

  let rows = (expenses || []).filter((e) => {
    if (category && e.category !== category) return false;
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (q) {
      const hay = `${e.description || ''} ${e.category || ''} ${nameOf(e.vendorId) || ''} ${e.paymentMode || ''} ${e.reference || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const mul = dir === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    let ka, kb;
    if (sortBy === 'amount') { ka = Number(a.amount) || 0; kb = Number(b.amount) || 0; }
    else if (sortBy === 'vendor') { ka = nameOf(a.vendorId) || ''; kb = nameOf(b.vendorId) || ''; }
    else { ka = a.createdAt || a.date || ''; kb = b.createdAt || b.date || ''; }
    if (ka < kb) return -1 * mul;
    if (ka > kb) return 1 * mul;
    return 0;
  });
  return rows;
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
 * Budget-vs-actual rows per category (Stage/Category budgets).
 * Merges spend (from categoryTotals) with the per-category budget map; returns
 * `[{ category, budget, spent, balance, pct }]` sorted by spend (largest first).
 * `pct` is clamped 0..100 for progress bars; `balance` (budget - spent) may go
 * negative on overspend. Categories appear if they have any spend OR any budget.
 */
export function categoryBudgetRows(expenses, categoryBudgets) {
  const budgets = categoryBudgets || {};
  const spentByCat = categoryTotals(expenses);
  const cats = new Set([...Object.keys(spentByCat), ...Object.keys(budgets)]);
  return [...cats]
    .map((category) => {
      const budget = Number(budgets[category]) || 0;
      const spent = Number(spentByCat[category]) || 0;
      const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
      return { category, budget, spent, balance: budget - spent, pct };
    })
    .sort((a, b) => b.spent - a.spent);
}

/** Sum of expense amounts per payment mode; blank/unknown modes bucket as 'Other'. */
export function paymentModeTotals(expenses) {
  const out = {};
  for (const e of expenses || []) {
    const mode = e.paymentMode || 'Other';
    out[mode] = (out[mode] || 0) + (Number(e.amount) || 0);
  }
  return out;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Per-month spending report, newest-first. Each entry:
 * `{ month: 'YYYY-MM', label: 'August 2026', count, total }`.
 * Blank-date expenses are skipped (they can't be bucketed by month).
 */
export function monthlyReport(expenses) {
  const buckets = new Map();
  for (const e of expenses || []) {
    if (!e.date) continue;
    const month = String(e.date).slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const b = buckets.get(month) || { month, count: 0, total: 0 };
    b.count += 1;
    b.total += Number(e.amount) || 0;
    buckets.set(month, b);
  }
  return [...buckets.values()]
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0))
    .map((b) => {
      const mi = Number(b.month.slice(5, 7)) - 1;
      const yr = b.month.slice(0, 4);
      return { ...b, label: `${MONTH_NAMES[mi] || b.month} ${yr}` };
    });
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
      ${
        snapshot.budget
          ? `<tr>
        <td style="padding:10px 12px;">Budget</td>
        <td style="padding:10px 12px;text-align:right;"><b>${formatINR(snapshot.budget)}</b></td>
        <td style="padding:10px 12px;">Remaining</td>
        <td style="padding:10px 12px;text-align:right;"><b style="color:${
          snapshot.remaining < 0 ? '#dc2626' : '#059669'
        };">${formatINR(snapshot.remaining)}</b></td>
      </tr>`
          : ''
      }
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
      Sent automatically by Kamal Kunj Expense Tracker.
    </p>
  </div>`;
}
