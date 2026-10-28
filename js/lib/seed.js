// js/lib/seed.js
// First-load seed data built from the owner's real records (Jun–Oct 2026).
// Served ONLY when the Blobs store is empty (see netlify/functions/_shared.js).
// After the first write, the live blob takes over and this is never used again.
//
// Notes on data fidelity:
//  - The source "Stage" column becomes `category`.
//  - Payment modes preserved verbatim: Online / Cash / Other.
//  - The one brick row had no vendor -> vendorId v_unknown ("Unknown").
//  - The final row had NO date in the notebook -> seeded with a placeholder
//    date and a "⚠ DATE UNVERIFIED" note so it can be fixed via Edit Expense.
//  - "verify ₹amount" style annotations are kept verbatim in the description.
//  - createdAt is deterministic (date + index), never Date.now(), so ordering
//    is stable and reproducible.

export const SEED_VENDORS = [
  { id: 'v_1', name: 'Satish Thekedar', category: 'Construction Labor', phone: '', rateType: 'daily', rateValue: 0, agreedTotal: 0, notes: '', status: 'active' },
  { id: 'v_2', name: 'Suyash', category: 'Sariya & Taar', phone: '', rateType: 'lumpsum', rateValue: 0, agreedTotal: 0, notes: 'Steel / sariya supplier', status: 'active' },
  { id: 'v_3', name: 'Vivek', category: 'Building Material', phone: '', rateType: 'lumpsum', rateValue: 0, agreedTotal: 0, notes: '', status: 'active' },
  { id: 'v_4', name: 'Rakesh', category: 'Demolition Work', phone: '', rateType: 'lumpsum', rateValue: 0, agreedTotal: 0, notes: 'Account marked settled/clear', status: 'done' },
  { id: 'v_5', name: 'Shankar', category: 'Boring Labor', phone: '', rateType: 'daily', rateValue: 0, agreedTotal: 0, notes: 'Account marked clear', status: 'done' },
  { id: 'v_6', name: 'Shri Krishna Pipe Fitting', category: 'Boring Material', phone: '', rateType: 'lumpsum', rateValue: 0, agreedTotal: 0, notes: 'Account marked clear', status: 'done' },
  { id: 'v_unknown', name: 'Unknown', category: 'Building Material', phone: '', rateType: 'lumpsum', rateValue: 0, agreedTotal: 0, notes: 'Vendor not recorded', status: 'active' },
];

// Raw rows in [date, vendorId, category, amount, mode, description] form.
// date is ISO (YYYY-MM-DD). Order: newest first (as the owner listed them).
const ROWS = [
  ['2026-10-26', 'v_1', 'Construction Labor', 60000, 'Online', 'Dharmendra'],
  ['2026-10-23', 'v_1', 'Construction Labor', 10000, 'Online', 'Dharmendra'],
  ['2026-10-08', 'v_2', 'Sariya & Taar', 14100, 'Cash', 'Old hisaab clear'],
  ['2026-10-06', 'v_1', 'Construction Labor', 50000, 'Online', 'Dharmendra'],
  ['2026-10-01', 'v_1', 'Construction Labor', 50000, 'Cash', ''],
  ['2026-10-01', 'v_3', 'Building Material', 25000, 'Online', 'Kasim'],
  ['2026-09-24', 'v_unknown', 'Building Material', 18550, 'Online', 'Brick'],
  ['2026-09-22', 'v_3', 'Building Material', 50000, 'Online', 'Building material payment; Notebook note: Shiv'],
  ['2026-09-21', 'v_3', 'Building Material', 30000, 'Online', 'Building material payment; Notebook note: Ram Sevak'],
  ['2026-09-18', 'v_1', 'Construction Labor', 80000, 'Cash', 'Construction labour payment'],
  ['2026-09-07', 'v_1', 'Construction Labor', 20000, 'Cash', 'Construction labour payment'],
  ['2026-09-01', 'v_3', 'Building Material', 50000, 'Online', 'Building material payment'],
  ['2026-08-27', 'v_1', 'Construction Labor', 50000, 'Online', 'Construction labour payment; amount appears as ₹50,000'],
  ['2026-08-26', 'v_1', 'Construction Labor', 30000, 'Cash', 'Construction labour payment'],
  ['2026-08-25', 'v_3', 'Building Material', 50000, 'Online', 'Building material payment; Notebook shows ₹25,000 + ₹25,000'],
  ['2026-08-25', 'v_2', 'Sariya & Taar', 139600, 'Online', 'Sariya/steel supplier payment'],
  ['2026-08-16', 'v_3', 'Building Material', 25000, 'Online', 'Building material payment'],
  ['2026-08-15', 'v_1', 'Construction Labor', 10000, 'Cash', 'Construction labour payment'],
  ['2026-08-15', 'v_2', 'Sariya & Taar', 9000, 'Other', 'Sariya/steel supplier payment; payment mode not clearly written'],
  ['2026-08-13', 'v_1', 'Construction Labor', 20000, 'Cash', 'Construction labour payment'],
  ['2026-08-12', 'v_3', 'Building Material', 60000, 'Online', 'Building material payment'],
  ['2026-08-06', 'v_3', 'Building Material', 16800, 'Cash', 'Building material payment; handwriting overwritten, recorded as ₹16,800 — verify against payment record'],
  ['2026-08-06', 'v_2', 'Sariya & Taar', 10000, 'Cash', 'Sariya/steel supplier payment; amount appears as ₹10,000 — please verify'],
  ['2026-08-01', 'v_3', 'Building Material', 30000, 'Cash', 'Building material payment'],
  ['2026-08-01', 'v_2', 'Sariya & Taar', 5000, 'Cash', 'Sariya/steel supplier payment'],
  ['2026-07-30', 'v_1', 'Construction Labor', 20000, 'Online', 'Construction labour payment'],
  ['2026-07-29', 'v_4', 'Demolition Work', 10000, 'Online', 'Demolition contractor payment; account marked settled/clear'],
  ['2026-07-27', 'v_5', 'Boring Labor', 4050, 'Online', 'Boring labour payment; account marked clear'],
  ['2026-07-27', 'v_2', 'Sariya & Taar', 100000, 'Cash', 'Sariya/steel supplier payment; amount appears as ₹1,00,000'],
  ['2026-07-25', 'v_5', 'Boring Labor', 5770, 'Online', 'Boring labour payment; account marked clear'],
  ['2026-07-25', 'v_1', 'Construction Labor', 2000, 'Online', 'Construction labour payment; notebook marks O/online'],
  ['2026-07-23', 'v_5', 'Boring Labor', 5000, 'Online', 'Boring labour payment; account marked clear'],
  ['2026-07-21', 'v_5', 'Boring Labor', 2000, 'Cash', 'Boring labour payment; account marked clear'],
  ['2026-07-18', 'v_4', 'Demolition Work', 45000, 'Other', 'Demolition contractor payment; account marked settled/clear'],
  ['2026-07-05', 'v_4', 'Demolition Work', 30000, 'Online', 'Demolition contractor payment; account marked settled/clear'],
  ['2026-06-29', 'v_4', 'Demolition Work', 20000, 'Online', 'Demolition contractor payment; account marked settled/clear'],
  ['2026-06-20', 'v_4', 'Demolition Work', 20000, 'Online', 'Demolition contractor payment; account marked settled/clear'],
  // Date not visible in the notebook — placeholder + explicit verify note.
  ['2026-07-01', 'v_6', 'Boring Material', 35840, 'Online', '⚠ DATE UNVERIFIED — please edit. Shri Krishna pipe fitting; account marked clear.'],
];

/** Build the seeded expense objects with stable ids + deterministic createdAt. */
export function buildSeedExpenses() {
  return ROWS.map((r, i) => {
    const [date, vendorId, category, amount, paymentMode, description] = r;
    // Deterministic createdAt: the date plus a per-index offset so same-day
    // rows keep their listed (newest-first) order under lastN sorting.
    const offset = String(ROWS.length - i).padStart(3, '0');
    return {
      id: `e_${i + 1}`,
      date,
      vendorId,
      amount,
      category,
      description,
      paymentMode,
      createdAt: `${date}T00:00:${offset.slice(-2)}.000Z`,
    };
  });
}

/** Full seed document (matches the blob shape). */
export function buildSeed() {
  const expenses = buildSeedExpenses();
  return {
    vendors: structuredClone(SEED_VENDORS),
    expenses,
    settings: { budget: 0, categoryBudgets: {} },
    seq: { vendor: 100, expense: expenses.length + 100 },
  };
}

export const SEED_EXPENSE_COUNT = ROWS.length;
