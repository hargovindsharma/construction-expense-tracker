// tests/calc.test.js — unit tests for the pure logic core (SRS acceptance criteria).
import { describe, it, expect } from 'vitest';
import {
  formatINR,
  totalSpent,
  spentThisMonth,
  vendorPaid,
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
