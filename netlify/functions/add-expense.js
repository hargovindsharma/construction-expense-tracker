// netlify/functions/add-expense.js
// POST /api/add-expense { op: add|update|delete, expense }
//   -> { vendors, expenses, emailSent }
// On a successful "add", emails EMAIL_TO with a snapshot + last 5 entries (FR-14..16).
import { Resend } from 'resend';
import { store, loadData, saveData, publicView, json, requirePin } from './_shared.js';
import {
  nextId,
  totalSpent,
  spentThisMonth,
  outstandingTotal,
  lastN,
  buildEmailHtml,
  formatINR,
} from '../../js/lib/calc.js';

const VALID_MODES = ['cash', 'UPI', 'bank'];

function sanitizeExpense(e) {
  return {
    date: String(e.date || '').trim(),
    vendorId: String(e.vendorId || '').trim(),
    amount: Number(e.amount) || 0,
    category: String(e.category || '').trim(),
    description: String(e.description || '').trim(),
    paymentMode: VALID_MODES.includes(e.paymentMode) ? e.paymentMode : 'UPI',
  };
}

async function sendEmail(data, expense) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !to || !from) {
    console.error('Email skipped: RESEND_API_KEY / EMAIL_TO / EMAIL_FROM not all set');
    return false;
  }

  const vendor = data.vendors.find((v) => v.id === expense.vendorId);
  const nameById = (id) => {
    const v = data.vendors.find((x) => x.id === id);
    return v ? v.name : '';
  };
  const snapshot = {
    total: totalSpent(data.expenses),
    month: spentThisMonth(data.expenses, new Date()),
    vendorCount: data.vendors.length,
    outstanding: outstandingTotal(data.vendors, data.expenses),
  };
  const html = buildEmailHtml({
    expense,
    vendor,
    snapshot,
    last5: lastN(data.expenses, 5),
    vendorName: nameById,
  });

  const resend = new Resend(apiKey);
  const subject = `🏗️ New expense — ${formatINR(expense.amount)}${
    vendor ? ` (${vendor.name})` : ''
  }`;
  await resend.emails.send({ from, to, subject, html });
  return true;
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

  const { op, expense } = payload || {};
  if (!op || !expense) return json(400, { error: 'Missing op or expense' });

  try {
    const s = store();
    const data = await loadData(s);
    let added = null;

    if (op === 'add') {
      const clean = sanitizeExpense(expense);
      if (!clean.vendorId || !data.vendors.some((v) => v.id === clean.vendorId)) {
        return json(400, { error: 'Valid vendor is required' });
      }
      if (!(clean.amount > 0)) return json(400, { error: 'Amount must be greater than 0' });
      if (!clean.date) return json(400, { error: 'Date is required' });
      const { id, seq } = nextId('e', data.seq.expense);
      data.seq.expense = seq;
      added = { id, ...clean, createdAt: new Date().toISOString() };
      data.expenses.push(added);
    } else if (op === 'update') {
      if (!expense.id) return json(400, { error: 'Expense id required for update' });
      const idx = data.expenses.findIndex((x) => x.id === expense.id);
      if (idx === -1) return json(400, { error: 'Expense not found' });
      const clean = sanitizeExpense(expense);
      if (!(clean.amount > 0)) return json(400, { error: 'Amount must be greater than 0' });
      data.expenses[idx] = { ...data.expenses[idx], ...clean };
    } else if (op === 'delete') {
      if (!expense.id) return json(400, { error: 'Expense id required for delete' });
      data.expenses = data.expenses.filter((x) => x.id !== expense.id);
    } else {
      return json(400, { error: `Unknown op: ${op}` });
    }

    await saveData(s, data); // expense is now persisted regardless of email

    let emailSent = false;
    if (op === 'add' && added) {
      try {
        emailSent = await sendEmail(data, added);
      } catch (mailErr) {
        console.error('Email send failed (expense still saved):', mailErr);
        emailSent = false;
      }
    }

    return json(200, { ...publicView(data), emailSent });
  } catch (err) {
    console.error('add-expense failed:', err);
    return json(500, { error: 'Could not save expense' });
  }
}
