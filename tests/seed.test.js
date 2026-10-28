// tests/seed.test.js — integrity checks for the preloaded real data.
import { describe, it, expect } from 'vitest';
import { buildSeed, buildSeedExpenses, SEED_VENDORS, SEED_EXPENSE_COUNT } from '../js/lib/seed.js';
import { totalSpent } from '../js/lib/calc.js';

describe('seed data', () => {
  it('has the expected number of expenses', () => {
    const exp = buildSeedExpenses();
    expect(exp).toHaveLength(38);
    expect(exp).toHaveLength(SEED_EXPENSE_COUNT);
  });

  it('totals the owner-verified sum ₹12,12,710', () => {
    expect(totalSpent(buildSeedExpenses())).toBe(1212710);
  });

  it('every expense references a known vendor', () => {
    const ids = new Set(SEED_VENDORS.map((v) => v.id));
    for (const e of buildSeedExpenses()) {
      expect(ids.has(e.vendorId)).toBe(true);
    }
  });

  it('every expense has required fields and positive amount', () => {
    for (const e of buildSeedExpenses()) {
      expect(e.id).toMatch(/^e_\d+$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.amount).toBeGreaterThan(0);
      expect(typeof e.category).toBe('string');
      expect(e.category.length).toBeGreaterThan(0);
    }
  });

  it('expense ids are unique', () => {
    const ids = buildSeedExpenses().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flags the dateless row for verification', () => {
    const flagged = buildSeedExpenses().filter((e) => /DATE UNVERIFIED/.test(e.description));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].amount).toBe(35840);
  });

  it('buildSeed returns full blob shape with seq past seeded ids', () => {
    const seed = buildSeed();
    expect(seed).toHaveProperty('vendors');
    expect(seed).toHaveProperty('expenses');
    expect(seed).toHaveProperty('settings.budget', 0);
    expect(seed.seq.expense).toBeGreaterThan(seed.expenses.length);
  });
});
