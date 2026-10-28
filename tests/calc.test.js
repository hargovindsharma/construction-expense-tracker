// tests/calc.test.js — unit tests for the pure logic core (SRS acceptance criteria).
import { describe, it, expect } from 'vitest';
import {
  formatINR,
  totalSpent,
  spentThisMonth,
  spentToday,
  vendorPaid,
  vendorTotals,
  categoryBudgetRows,
  paymentModeTotals,
  monthlyReport,
  filterSortExpenses,
  lumpsumBalance,
  percentComplete,
  outstandingTotal,
  categoryTotals,
  lastN,
  nextId,
  escapeHtml,
  buildEmailHtml,
} from '../js/lib/calc.js';

const vendors = [
  { id: 'v_1', name: 'Ramesh', category: 'Masonry', rateType: 'lumpsum', agreedTotal: 500000 },
  { id: 'v_2', name: 'Suresh', category: 'Plumbing', rateType: 'daily', rateValue: 800 },
  { id: 'v_3', name: 'Bore Co', category: 'Boring', rateType: 'lumpsum', agreedTotal: 100000 },
];
const expenses = [
  { id: 'e_1', date: '2026-10-05', vendorId: 'v_1', amount: 200000, category: 'Masonry', createdAt: '2026-10-05T10:00:00Z' },
  { id: 'e_2', date: '2026-10-20', vendorId: 'v_2', amount: 8000, category: 'Plumbing', createdAt: '2026-10-20T10:00:00Z' },
  { id: 'e_3', date: '2026-09-15', vendorId: 'v_1', amount: 50000, category: 'Masonry', createdAt: '2026-09-15T10:00:00Z' },
  { id: 'e_4', date: '2026-10-25', vendorId: 'v_3', amount: 100000, category: 'Boring', createdAt: '2026-10-25T10:00:00Z' },
];

describe('formatINR', () => {
  it('formats with Indian grouping and no decimals', () => {
    expect(formatINR(123456)).toBe('₹1,23,456');
  });
  it('handles 0 and non-numbers safely', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(undefined)).toBe('₹0');
    expect(formatINR(NaN)).toBe('₹0');
  });
});

describe('totalSpent (FR-9)', () => {
  it('sums all amounts', () => {
    expect(totalSpent(expenses)).toBe(358000);
  });
  it('is 0 for empty', () => {
    expect(totalSpent([])).toBe(0);
    expect(totalSpent(undefined)).toBe(0);
  });
});

describe('spentThisMonth (FR-10)', () => {
  it('sums only the reference month', () => {
    // October 2026: 200000 + 8000 + 100000 = 308000 (Sept 50000 excluded)
    const ref = new Date('2026-10-28T00:00:00');
    expect(spentThisMonth(expenses, ref)).toBe(308000);
  });
  it('respects month boundaries', () => {
    const ref = new Date('2026-09-30T00:00:00');
    expect(spentThisMonth(expenses, ref)).toBe(50000);
  });
  it('is 0 when no expenses in month', () => {
    const ref = new Date('2026-01-01T00:00:00');
    expect(spentThisMonth(expenses, ref)).toBe(0);
  });
  it('defaults to the current month when no ref is passed (dashboard call)', () => {
    // Regression: dashboard calls spentThisMonth(expenses) with no date.
    // new Date(undefined) is Invalid Date and silently returned 0 before the fix.
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    expect(spentThisMonth([{ date: iso, amount: 4200 }])).toBe(4200);
  });
});

describe('spentToday', () => {
  it('sums only the reference day', () => {
    const ref = new Date('2026-10-20T00:00:00');
    expect(spentToday(expenses, ref)).toBe(8000); // only e_2 on 10-20
  });
  it('defaults to the current day when no ref is passed (dashboard call)', () => {
    // Regression: dashboard calls spentToday(expenses) with no date.
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(spentToday([{ date: iso, amount: 300 }])).toBe(300);
  });
});

describe('vendorPaid', () => {
  it('sums per vendor', () => {
    expect(vendorPaid(expenses, 'v_1')).toBe(250000);
    expect(vendorPaid(expenses, 'v_2')).toBe(8000);
  });
  it('is 0 for unknown vendor', () => {
    expect(vendorPaid(expenses, 'nope')).toBe(0);
  });
});

describe('vendorTotals (vendor-wise bar chart)', () => {
  const nameOf = (id) => vendors.find((v) => v.id === id)?.name || '';
  it('sums per vendor, sorted largest-first, with names', () => {
    const r = vendorTotals(expenses, nameOf);
    expect(r).toEqual([
      { vendorId: 'v_1', name: 'Ramesh', total: 250000 },
      { vendorId: 'v_3', name: 'Bore Co', total: 100000 },
      { vendorId: 'v_2', name: 'Suresh', total: 8000 },
    ]);
  });
  it('labels missing vendorId as Unknown', () => {
    const r = vendorTotals([{ amount: 500 }], nameOf);
    expect(r).toEqual([{ vendorId: '', name: 'Unknown', total: 500 }]);
  });
  it('falls back to the id when no resolver is given', () => {
    const r = vendorTotals([{ vendorId: 'v_9', amount: 10 }]);
    expect(r).toEqual([{ vendorId: 'v_9', name: 'v_9', total: 10 }]);
  });
  it('is empty for no expenses', () => {
    expect(vendorTotals([])).toEqual([]);
  });
});

describe('categoryBudgetRows (Stage/Category budgets)', () => {
  it('returns rows with spent/balance/pct, sorted by spent desc', () => {
    const rows = categoryBudgetRows(expenses, { Masonry: 400000, Boring: 100000 });
    // Masonry spent 250000 (e_1+e_3), Boring 100000, Plumbing 8000 (no budget)
    expect(rows[0]).toEqual({ category: 'Masonry', budget: 400000, spent: 250000, balance: 150000, pct: 62.5 });
    const boring = rows.find((r) => r.category === 'Boring');
    expect(boring).toEqual({ category: 'Boring', budget: 100000, spent: 100000, balance: 0, pct: 100 });
  });
  it('includes categories with spend but no budget (budget 0, balance negative of spent)', () => {
    const rows = categoryBudgetRows(expenses, {});
    const plumbing = rows.find((r) => r.category === 'Plumbing');
    expect(plumbing).toEqual({ category: 'Plumbing', budget: 0, spent: 8000, balance: -8000, pct: 0 });
  });
  it('caps pct at 100 on overspend but balance goes negative', () => {
    const rows = categoryBudgetRows([{ category: 'X', amount: 150 }], { X: 100 });
    expect(rows[0]).toEqual({ category: 'X', budget: 100, spent: 150, balance: -50, pct: 100 });
  });
  it('includes budgeted categories with no spend', () => {
    const rows = categoryBudgetRows([], { Cement: 5000 });
    expect(rows).toEqual([{ category: 'Cement', budget: 5000, spent: 0, balance: 5000, pct: 0 }]);
  });
  it('is empty when no expenses and no budgets', () => {
    expect(categoryBudgetRows([], {})).toEqual([]);
  });
});

describe('paymentModeTotals', () => {
  const mixed = [
    { amount: 100, paymentMode: 'Cash' },
    { amount: 200, paymentMode: 'Online' },
    { amount: 50, paymentMode: 'Cash' },
    { amount: 25, paymentMode: '' },
  ];
  it('sums amounts per payment mode', () => {
    expect(paymentModeTotals(mixed)).toEqual({ Cash: 150, Online: 200, Other: 25 });
  });
  it('is empty object for no expenses', () => {
    expect(paymentModeTotals([])).toEqual({});
  });
});

describe('monthlyReport', () => {
  it('groups by month newest-first with count and label', () => {
    const r = monthlyReport(expenses);
    expect(r).toEqual([
      { month: '2026-10', label: 'October 2026', count: 3, total: 308000 },
      { month: '2026-09', label: 'September 2026', count: 1, total: 50000 },
    ]);
  });
  it('skips blank-date rows', () => {
    const r = monthlyReport([{ date: '', amount: 999 }, { date: '2026-05-01', amount: 10 }]);
    expect(r).toEqual([{ month: '2026-05', label: 'May 2026', count: 1, total: 10 }]);
  });
  it('is empty for no expenses', () => {
    expect(monthlyReport([])).toEqual([]);
  });
});

describe('filterSortExpenses — reference search', () => {
  const rows = [
    { id: 'a', date: '2026-10-01', amount: 10, description: '', category: 'X', vendorId: 'v1', paymentMode: 'Cash', reference: 'UPI-12345' },
    { id: 'b', date: '2026-10-02', amount: 20, description: 'bricks', category: 'X', vendorId: 'v1', paymentMode: 'Cash', reference: '' },
  ];
  it('matches on the reference field', () => {
    const r = filterSortExpenses(rows, { query: '12345' });
    expect(r.map((e) => e.id)).toEqual(['a']);
  });
});

describe('lumpsumBalance (FR-12, AC-3)', () => {
  it('agreed 5,00,000 minus paid 2,00,000 = 3,00,000', () => {
    const paid = vendorPaid(expenses, 'v_1'); // 250000
    expect(lumpsumBalance(vendors[0], paid)).toBe(250000);
  });
  it('AC-3 exact scenario: agreed 500000, paid 200000 -> 300000', () => {
    expect(lumpsumBalance({ rateType: 'lumpsum', agreedTotal: 500000 }, 200000)).toBe(300000);
  });
  it('never goes negative (overspend)', () => {
    expect(lumpsumBalance({ rateType: 'lumpsum', agreedTotal: 100000 }, 150000)).toBe(0);
  });
  it('is 0 for non-lumpsum vendors', () => {
    expect(lumpsumBalance(vendors[1], 99999)).toBe(0);
  });
});

describe('percentComplete', () => {
  it('computes percent for lumpsum', () => {
    expect(percentComplete({ rateType: 'lumpsum', agreedTotal: 500000 }, 250000)).toBe(50);
  });
  it('caps at 100 on overspend', () => {
    expect(percentComplete({ rateType: 'lumpsum', agreedTotal: 100000 }, 200000)).toBe(100);
  });
  it('0 when agreed is 0 or non-lumpsum', () => {
    expect(percentComplete({ rateType: 'lumpsum', agreedTotal: 0 }, 100)).toBe(0);
    expect(percentComplete({ rateType: 'daily' }, 100)).toBe(0);
  });
});

describe('outstandingTotal (FR-12)', () => {
  it('sums lumpsum balances only', () => {
    // v_1: 500000-250000=250000 ; v_3: 100000-100000=0 ; v_2 not lumpsum
    expect(outstandingTotal(vendors, expenses)).toBe(250000);
  });
  it('is 0 with no vendors', () => {
    expect(outstandingTotal([], expenses)).toBe(0);
  });
});

describe('categoryTotals (FR-13)', () => {
  it('groups by category', () => {
    expect(categoryTotals(expenses)).toEqual({
      Masonry: 250000,
      Plumbing: 8000,
      Boring: 100000,
    });
  });
  it('buckets missing category as Uncategorized', () => {
    expect(categoryTotals([{ amount: 10 }])).toEqual({ Uncategorized: 10 });
  });
});

describe('lastN (email last-5, FR-15)', () => {
  it('returns newest first, limited to n', () => {
    const r = lastN(expenses, 2);
    expect(r.map((e) => e.id)).toEqual(['e_4', 'e_2']); // 10-25, then 10-20
  });
  it('returns all when n exceeds length', () => {
    expect(lastN(expenses, 10)).toHaveLength(4);
  });
  it('handles empty', () => {
    expect(lastN([], 5)).toEqual([]);
  });
});

describe('nextId', () => {
  it('increments and formats', () => {
    expect(nextId('v', 0)).toEqual({ id: 'v_1', seq: 1 });
    expect(nextId('e', 41)).toEqual({ id: 'e_42', seq: 42 });
  });
});

describe('escapeHtml', () => {
  it('escapes dangerous characters', () => {
    expect(escapeHtml('<b>"x"&\'y\'')).toBe('&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;');
  });
});

describe('buildEmailHtml (FR-15)', () => {
  const html = buildEmailHtml({
    expense: expenses[3], // boring 100000
    vendor: vendors[2],
    snapshot: { total: 358000, month: 308000, vendorCount: 3, outstanding: 250000 },
    last5: lastN(expenses, 5),
    vendorName: (id) => vendors.find((v) => v.id === id)?.name || '',
  });
  it('includes the new amount and vendor', () => {
    expect(html).toContain('₹1,00,000');
    expect(html).toContain('Bore Co');
  });
  it('includes snapshot figures', () => {
    expect(html).toContain('₹3,58,000'); // total
    expect(html).toContain('₹2,50,000'); // outstanding
  });
  it('includes a last-entries table with vendor names', () => {
    expect(html).toContain('Last');
    expect(html).toContain('Ramesh');
    expect(html).toContain('Suresh');
  });
});
