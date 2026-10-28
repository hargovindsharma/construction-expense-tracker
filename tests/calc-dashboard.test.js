// tests/calc-dashboard.test.js — TDD for the new dashboard/analytics pure functions.
// Written before implementation (red), then calc.js is extended to make them pass (green).
import { describe, it, expect } from 'vitest';
import {
  spentToday,
  transactionCount,
  budgetRemaining,
  budgetUsedPct,
  monthlySeries,
  trendVsPrevious,
  categoryBreakdown,
  filterSortExpenses,
} from '../js/lib/calc.js';

const E = [
  { id: 'e_1', date: '2026-10-28', vendorId: 'v_1', amount: 1000, category: 'Labour', description: 'day work', paymentMode: 'Cash', createdAt: '2026-10-28T09:00:00Z' },
  { id: 'e_2', date: '2026-10-28', vendorId: 'v_2', amount: 2000, category: 'Steel', description: 'rods', paymentMode: 'Online', createdAt: '2026-10-28T10:00:00Z' },
  { id: 'e_3', date: '2026-10-05', vendorId: 'v_1', amount: 5000, category: 'Labour', description: '', paymentMode: 'Cash', createdAt: '2026-10-05T10:00:00Z' },
  { id: 'e_4', date: '2026-09-15', vendorId: 'v_3', amount: 8000, category: 'Cement', description: 'bags', paymentMode: 'Bank', createdAt: '2026-09-15T10:00:00Z' },
  { id: 'e_5', date: '2026-08-10', vendorId: 'v_2', amount: 4000, category: 'Steel', description: '', paymentMode: 'Online', createdAt: '2026-08-10T10:00:00Z' },
];
const REF = new Date('2026-10-28T12:00:00'); // "today"

describe('spentToday', () => {
  it('sums only expenses on the reference day', () => {
    expect(spentToday(E, REF)).toBe(3000); // e_1 + e_2
  });
  it('is 0 when nothing today', () => {
    expect(spentToday(E, new Date('2026-10-27T12:00:00'))).toBe(0);
    expect(spentToday([], REF)).toBe(0);
  });
});

describe('transactionCount', () => {
  it('counts entries', () => {
    expect(transactionCount(E)).toBe(5);
    expect(transactionCount([])).toBe(0);
    expect(transactionCount(undefined)).toBe(0);
  });
});

describe('budgetRemaining', () => {
  it('budget minus total spent', () => {
    // total = 1000+2000+5000+8000+4000 = 20000
    expect(budgetRemaining(50000, E)).toBe(30000);
  });
  it('goes negative on overspend', () => {
    expect(budgetRemaining(15000, E)).toBe(-5000);
  });
  it('treats missing/zero budget as 0 budget', () => {
    expect(budgetRemaining(0, E)).toBe(-20000);
    expect(budgetRemaining(undefined, E)).toBe(-20000);
  });
});

describe('budgetUsedPct', () => {
  it('percentage of budget used, clamped 0..100', () => {
    expect(budgetUsedPct(50000, E)).toBe(40); // 20000/50000
    expect(budgetUsedPct(15000, E)).toBe(100); // overspend clamps
  });
  it('is 0 when budget is 0 or missing', () => {
    expect(budgetUsedPct(0, E)).toBe(0);
    expect(budgetUsedPct(undefined, E)).toBe(0);
  });
});

describe('monthlySeries', () => {
  it('returns last N months newest-last with totals', () => {
    const s = monthlySeries(E, 3, REF); // Aug, Sep, Oct
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({ label: 'Aug', total: 4000 });
    expect(s[1]).toMatchObject({ label: 'Sep', total: 8000 });
    expect(s[2]).toMatchObject({ label: 'Oct', total: 8000 }); // 1000+2000+5000
  });
  it('fills empty months with 0', () => {
    const s = monthlySeries([], 2, REF);
    expect(s.map((x) => x.total)).toEqual([0, 0]);
  });
});

describe('trendVsPrevious', () => {
  it('compares current month to previous', () => {
    const t = trendVsPrevious(E, REF);
    expect(t.current).toBe(8000); // Oct
    expect(t.previous).toBe(8000); // Sep
    expect(t.deltaPct).toBe(0);
    expect(t.direction).toBe('flat');
  });
  it('reports up when current exceeds previous', () => {
    const ref = new Date('2026-09-30T12:00:00'); // current Sep(8000) vs Aug(4000)
    const t = trendVsPrevious(E, ref);
    expect(t.current).toBe(8000);
    expect(t.previous).toBe(4000);
    expect(t.deltaPct).toBe(100);
    expect(t.direction).toBe('up');
  });
  it('handles zero previous without dividing by zero', () => {
    const ref = new Date('2026-08-31T12:00:00'); // Aug(4000) vs Jul(0)
    const t = trendVsPrevious(E, ref);
    expect(t.previous).toBe(0);
    expect(t.direction).toBe('up');
    expect(Number.isFinite(t.deltaPct)).toBe(true);
  });
});

describe('categoryBreakdown', () => {
  it('returns categories sorted by total desc with pct', () => {
    const b = categoryBreakdown(E);
    // Labour 6000, Steel 6000, Cement 8000 -> total 20000
    expect(b[0].category).toBe('Cement');
    expect(b[0].total).toBe(8000);
    expect(b[0].pct).toBeCloseTo(40, 5);
    const sum = b.reduce((a, c) => a + c.total, 0);
    expect(sum).toBe(20000);
  });
  it('empty for no expenses', () => {
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe('filterSortExpenses', () => {
  it('filters by free-text query across description/category/vendor', () => {
    const r = filterSortExpenses(E, { query: 'rods' });
    expect(r.map((x) => x.id)).toEqual(['e_2']);
  });
  it('filters by category', () => {
    const r = filterSortExpenses(E, { category: 'Steel' });
    expect(r.map((x) => x.id).sort()).toEqual(['e_2', 'e_5']);
  });
  it('filters by date range inclusive', () => {
    const r = filterSortExpenses(E, { from: '2026-09-01', to: '2026-10-06' });
    expect(r.map((x) => x.id).sort()).toEqual(['e_3', 'e_4']);
  });
  it('sorts by amount ascending', () => {
    const r = filterSortExpenses(E, { sortBy: 'amount', dir: 'asc' });
    expect(r.map((x) => x.amount)).toEqual([1000, 2000, 4000, 5000, 8000]);
  });
  it('defaults to date descending (newest first)', () => {
    const r = filterSortExpenses(E, {});
    expect(r[0].id).toBe('e_2'); // 10-28 latest createdAt
    expect(r[r.length - 1].id).toBe('e_5'); // 08-10
  });
  it('does not mutate the input array', () => {
    const copy = [...E];
    filterSortExpenses(E, { sortBy: 'amount', dir: 'asc' });
    expect(E).toEqual(copy);
  });
});
