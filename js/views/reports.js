// js/views/reports.js
// Printable reports: KPI summary + three tables (category budget/spend, vendor
// paid, monthly spending). All figures come from calc.js pure functions. The
// "Print / Save PDF" button triggers window.print(); the @media print block in
// style.css hides the app chrome so only this view is printed.
import {
  totalSpent,
  transactionCount,
  categoryBudgetRows,
  vendorTotals,
  monthlyReport,
  paymentModeTotals,
  formatINR,
} from '../lib/calc.js';
import { getCategory } from '../lib/categories.js';
import { kpiCard, emptyState } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { getState, vendorName } from '../store.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderReports(mount) {
  const s = getState();
  if (s.loading) {
    mount.innerHTML = `<div class="view-head"><h1>Reports</h1></div><div class="card">Loading…</div>`;
    return;
  }

  const { expenses, settings } = s;
  if (!expenses.length) {
    mount.innerHTML = `
      <div class="view-head"><div><h1>Reports</h1><p class="view-sub">Summaries you can print or save as PDF</p></div></div>
      ${emptyState({ iconName: 'chart', title: 'No data to report yet', text: 'Add expenses to see category, vendor, and monthly reports.' })}`;
    return;
  }

  const budget = settings?.budget || 0;
  const total = totalSpent(expenses);
  const txns = transactionCount(expenses);
  const catRows = categoryBudgetRows(expenses, settings?.categoryBudgets || {});
  const vendRows = vendorTotals(expenses, vendorName);
  const months = monthlyReport(expenses);
  const modes = paymentModeTotals(expenses);

  const modeLine = Object.entries(modes)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `${esc(m)} ${formatINR(v)}`)
    .join(' · ');

  const kpis = `
    <div class="kpis">
      ${kpiCard({ label: 'Overall Spending', value: formatINR(total), iconName: 'wallet', tone: 'primary' })}
      ${kpiCard({ label: 'Payments', value: String(txns), iconName: 'hash', tone: 'neutral' })}
      ${kpiCard({ label: 'Project Budget', value: budget > 0 ? formatINR(budget) : '—', iconName: 'piggy', tone: budget > 0 ? 'success' : 'neutral' })}
    </div>`;

  const catTable = `
    <section class="card list-card">
      <div class="card-head"><h2>Category Report</h2></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Category</th><th class="num">Budget</th><th class="num">Spent</th><th class="num">Balance</th></tr></thead>
          <tbody>
            ${catRows.map((r) => `
              <tr>
                <td>${esc(getCategory(r.category).label)}</td>
                <td class="num">${r.budget > 0 ? formatINR(r.budget) : '—'}</td>
                <td class="num strong">${formatINR(r.spent)}</td>
                <td class="num ${r.budget > 0 && r.balance < 0 ? 'neg' : ''}">${r.budget > 0 ? formatINR(r.balance) : '—'}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Total</td><td class="num"></td><td class="num strong">${formatINR(total)}</td><td class="num"></td></tr></tfoot>
        </table>
      </div>
    </section>`;

  const vendTable = `
    <section class="card list-card">
      <div class="card-head"><h2>Vendor Report</h2></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Vendor</th><th class="num">Total Paid</th></tr></thead>
          <tbody>
            ${vendRows.map((r) => `
              <tr><td>${esc(r.name)}</td><td class="num strong">${formatINR(r.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  const monthTable = `
    <section class="card list-card">
      <div class="card-head"><h2>Monthly Spending</h2></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Month</th><th class="num">Payments</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${months.map((m) => `
              <tr><td>${esc(m.label)}</td><td class="num">${m.count}</td><td class="num strong">${formatINR(m.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  mount.innerHTML = `
    <div class="view-head">
      <div><h1>Reports</h1><p class="view-sub">Summaries you can print or save as PDF</p></div>
      <button class="btn primary" id="rep-print">${icon('print', { size: 16 })} Print / Save PDF</button>
    </div>
    ${kpis}
    ${modeLine ? `<p class="muted report-modes">Payment split — ${modeLine}</p>` : ''}
    ${catTable}
    ${vendTable}
    ${monthTable}`;

  mount.querySelector('#rep-print')?.addEventListener('click', () => window.print());
}
