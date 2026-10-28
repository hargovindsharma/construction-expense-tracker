// js/views/dashboard.js
// KPI cards + 3 charts + recent-5 preview. Pure render from store state;
// re-renders whenever the store emits. All math comes from calc.js.
import {
  totalSpent, spentThisMonth, spentToday, transactionCount,
  budgetRemaining, budgetUsedPct, lastN, formatINR, categoryBudgetRows,
} from '../lib/calc.js';
import { kpiCard, chartCard, categoryBadge, budgetBar, emptyState, skeletonCards } from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { renderVendorBar, renderCategoryDonut, renderTrendLine, chartsAvailable } from '../ui/charts.js';
import { getState, vendorName } from '../store.js';
import { getCategory } from '../lib/categories.js';
import { openExpenseDrawer } from './expense-drawer.js';

export function renderDashboard(mount) {
  const s = getState();
  if (s.loading) {
    mount.innerHTML = `<div class="view-head"><h1>Dashboard</h1></div>${skeletonCards(6)}`;
    return;
  }

  const { expenses, settings } = s;
  const budget = settings.budget || 0;
  const total = totalSpent(expenses);
  const month = spentThisMonth(expenses);
  const today = spentToday(expenses);
  const remaining = budgetRemaining(budget, expenses);
  const usedPct = budgetUsedPct(budget, expenses);
  const txns = transactionCount(expenses);

  const remainingCard = budget > 0
    ? kpiCard({
        label: remaining < 0 ? 'Over Budget' : 'Remaining Budget',
        value: formatINR(Math.abs(remaining)),
        iconName: 'piggy',
        tone: remaining < 0 ? 'danger' : 'success',
        ring: usedPct,
        sub: `<span class="kpi-mute">${formatINR(budget)} budget</span>`,
      })
    : kpiCard({
        label: 'Remaining Budget',
        value: 'Set budget',
        iconName: 'piggy',
        tone: 'neutral',
        sub: `<a class="kpi-link" href="#/settings">Add in Settings</a>`,
      });

  const kpis = `
    <div class="kpis">
      ${kpiCard({ label: 'Total Expenses', value: formatINR(total), iconName: 'wallet', tone: 'primary' })}
      ${kpiCard({ label: 'This Month', value: formatINR(month), iconName: 'calendar', tone: 'primary' })}
      ${kpiCard({ label: 'Today', value: formatINR(today), iconName: 'sun', tone: 'warning' })}
      ${remainingCard}
      ${kpiCard({ label: 'Transactions', value: String(txns), iconName: 'hash', tone: 'neutral' })}
    </div>`;

  const charts = chartsAvailable()
    ? `<div class="chart-grid">
         ${chartCard({ title: 'Paid by Vendor', canvasId: 'chart-vendor' })}
         ${chartCard({ title: 'By Category', canvasId: 'chart-donut' })}
         ${chartCard({ title: 'Spending Trend', canvasId: 'chart-trend' })}
       </div>`
    : `<div class="card note">Charts need an internet connection (Chart.js). Your data and totals still work offline.</div>`;

  // Budget vs Actual — only shown once the user has set any category budget.
  const budgetRows = categoryBudgetRows(expenses, settings.categoryBudgets || {})
    .filter((r) => r.budget > 0);
  const budgetHtml = budgetRows.length
    ? `<section class="card budget-vs-actual">
         <div class="card-head">
           <h2>Budget vs Actual</h2>
           <a class="link-btn" href="#/settings">Edit budgets ${icon('chevronRight', { size: 15 })}</a>
         </div>
         <div class="budget-list">
           ${budgetRows.map((r) => budgetBar({ label: getCategory(r.category).label, spent: r.spent, budget: r.budget, pct: r.pct })).join('')}
         </div>
       </section>`
    : '';

  const recent = lastN(expenses, 5);
  const recentHtml = recent.length
    ? `<section class="card list-card">
         <div class="card-head">
           <h2>Recent Expenses</h2>
           <a class="link-btn" href="#/expenses">View all ${icon('chevronRight', { size: 15 })}</a>
         </div>
         <div class="table-wrap">
           <table class="data-table">
             <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th class="num">Amount</th></tr></thead>
             <tbody>
               ${recent.map((e) => `
                 <tr>
                   <td class="nowrap">${fmtDate(e.date)}</td>
                   <td>${categoryBadge(e.category)}</td>
                   <td>${escName(vendorName(e.vendorId))}</td>
                   <td class="num strong">${formatINR(e.amount)}</td>
                 </tr>`).join('')}
             </tbody>
           </table>
         </div>
       </section>`
    : emptyState({ iconName: 'receipt', title: 'No expenses yet', text: 'Add your first expense to see totals, charts, and trends.', ctaId: 'empty-add', ctaLabel: 'Add Expense' });

  mount.innerHTML = `
    <div class="view-head">
      <div><h1>Dashboard</h1><p class="view-sub">Overview of your construction spend</p></div>
    </div>
    ${kpis}
    ${charts}
    ${budgetHtml}
    ${recentHtml}`;

  // Draw charts after DOM is in place.
  if (chartsAvailable() && expenses.length) {
    renderVendorBar('chart-vendor', expenses, { vendorName });
    renderCategoryDonut('chart-donut', expenses);
    renderTrendLine('chart-trend', expenses, { months: 6 });
  }

  mount.querySelector('#empty-add')?.addEventListener('click', () => openExpenseDrawer());
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}
function escName(s) {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
