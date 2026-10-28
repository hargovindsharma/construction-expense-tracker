# 02 — Software Design Document (SDD)

**Project:** Construction Expense Tracker
**Date:** 2026-10-28
**Status:** Draft for review
**Traces:** `01-requirements.md`

---

## 1. Architecture Overview

```
   ┌─────────────────────────────┐
   │   Browser (phone / laptop)  │
   │  index.html + style.css     │
   │  app.js  +  lib/calc.js     │
   └───────────┬─────────────────┘
               │  fetch()  (PIN in x-app-pin header on writes)
               ▼
   ┌─────────────────────────────┐
   │   Netlify Functions (Node)  │
   │  get-data · save-vendor ·   │
   │  add-expense                │
   └───────┬──────────────┬──────┘
           │              │
           ▼              ▼
   ┌───────────────┐  ┌──────────────┐
   │ Netlify Blobs │  │  Resend API  │  (email, add-expense only)
   │  data.json    │  └──────────────┘
   └───────────────┘
```

- **Frontend:** static files, no framework, no build step. Pure ES modules.
- **Backend:** three serverless functions. Stateless; each read-modify-writes the blob.
- **Storage:** one JSON document `data.json` in a Blobs store named `expenses`.
- **Email:** Resend, called only from `add-expense` after a successful save.

## 2. Data Model

Single blob, key `data.json`, in store `expenses`:

```json
{
  "vendors":  [ /* Vendor objects — see SRS §6 */ ],
  "expenses": [ /* Expense objects — see SRS §6 */ ],
  "seq": { "vendor": 0, "expense": 0 }
}
```

- `seq` holds monotonic counters for id generation (`v_1`, `e_1`, …) so we avoid relying on
  `Date.now()`/random inside functions and ids stay stable and readable.
- Missing/absent blob is seeded to `{ vendors: [], expenses: [], seq: {vendor:0,expense:0} }`.

## 3. Module Design

### 3.1 `js/lib/calc.js` (pure, unit-tested — SRS §6 derived values)
Framework-free pure functions, no DOM, no network — this is the testable core.

| Function | Signature | Purpose |
|----------|-----------|---------|
| `formatINR(n)` | `(number) → string` | `₹1,23,456` via `Intl.NumberFormat('en-IN')` |
| `totalSpent(expenses)` | `→ number` | Σ amounts (FR-9) |
| `spentThisMonth(expenses, ref)` | `→ number` | current-month sum; `ref` = reference date for testability (FR-10) |
| `vendorPaid(expenses, vendorId)` | `→ number` | per-vendor sum |
| `lumpsumBalance(vendor, paid)` | `→ number` | `max(agreedTotal − paid, 0)` (FR-12) |
| `percentComplete(vendor, paid)` | `→ number` | `min(paid/agreedTotal,1)*100` or 0 |
| `outstandingTotal(vendors, expenses)` | `→ number` | Σ lumpsum balances |
| `categoryTotals(expenses)` | `→ {cat: sum}` | grouped (FR-13) |
| `lastN(expenses, n)` | `→ Expense[]` | newest-first by `createdAt`, take n |
| `buildEmailHtml({expense, vendor, snapshot, last5})` | `→ string` | email body (FR-15) |
| `nextId(prefix, seq)` | `(str, number) → {id, seq}` | id generator |

### 3.2 `js/app.js` (UI controller — browser only)
- On load: `GET /api/get-data` → render everything.
- Holds in-memory copy of `{vendors, expenses}`; re-renders after each successful write.
- Reads PIN from `sessionStorage` (`cet_pin`); prompts if absent before a write.
- Form handlers build payloads and `POST` to the right function; on 200, replace state and
  re-render; on 401, clear PIN and re-prompt; on other errors, show an inline message.
- Rendering helpers write to DOM nodes by id (no virtual DOM).

### 3.3 Functions (`netlify/functions/*.js`)
Each imports `@netlify/blobs` `getStore`. Shared inline helpers (duplicated, small):
`loadData(store)`, `saveData(store, data)`, `requirePin(req)` (compares `x-app-pin` header
to `process.env.APP_PIN`; returns 401 response if mismatch), `json(status, body)`.

## 4. API Contract

Base path `/api/*` → `/.netlify/functions/*` (via `netlify.toml` redirect).

### GET `/api/get-data`
- **Auth:** none (reads open — FR-17).
- **200:** `{ vendors:[], expenses:[] }` (seq omitted from response).

### POST `/api/save-vendor`
- **Headers:** `x-app-pin: <PIN>`, `Content-Type: application/json`
- **Body:** `{ op: "add"|"update"|"delete", vendor: {…} }`
  - `add`: vendor without id; server assigns `v_<n>`.
  - `update`/`delete`: vendor must include `id`.
- **200:** `{ vendors, expenses }` (full fresh state)
- **401:** `{ error: "Invalid PIN" }` · **400:** `{ error: "<validation msg>" }`

### POST `/api/add-expense`
- **Headers:** `x-app-pin`, `Content-Type: application/json`
- **Body:** `{ op: "add"|"update"|"delete", expense: {…} }`
- **Behavior:**
  1. `requirePin` → 401 if bad.
  2. Validate (vendor exists, amount > 0, date present) → 400 on failure.
  3. Load → mutate → `saveData` (expense now persisted).
  4. **If `op === "add"`:** build snapshot + last5, send Resend email in `try/catch`
     (failure logged only — FR-16).
  5. **200:** `{ vendors, expenses, emailSent: boolean }`

## 5. Sequence — "Add Expense" (FR-5, FR-14, FR-16)

```
User → app.js:        submit expense form
app.js → add-expense: POST /api/add-expense {op:add, expense} + x-app-pin
add-expense:          requirePin OK → validate OK
add-expense → Blobs:  load data.json → push expense (id e_n) → setJSON
add-expense → Resend: send email {snapshot, last5}   [try/catch]
add-expense → app.js: 200 {vendors, expenses, emailSent}
app.js → DOM:         replace state, re-render KPIs + tables
```

If Resend throws: log `console.error`, set `emailSent:false`, still return 200. The user sees
the expense saved; app.js may show a subtle "saved (email not sent)" note.

## 6. UI / Layout (single page, mobile-first — NFR-4,5)

Vertical stack, max-width ~720px centered:

```
┌──────────────────────────────────────┐
│ 🏗️  Construction Expense Tracker      │  header
│ [ PIN: ______ ]  (shows ✓ when set)   │  pin bar
├──────────────────────────────────────┤
│ [Total ₹] [This Month ₹] [Vendors #]  │  KPI cards (grid, wraps on mobile)
│ [Outstanding ₹]                        │
├──────────────────────────────────────┤
│ ＋ Add Expense                         │  primary form (first — most used)
│  vendor▾  amount  date  mode▾  note    │
│  [ Add Expense ]                       │
├──────────────────────────────────────┤
│ ＋ Add / Manage Vendor  (collapsible)  │
│  name category ratetype▾ rate agreed…  │
├──────────────────────────────────────┤
│ Vendor Summary                         │  table w/ balance + % bar
├──────────────────────────────────────┤
│ Spend by Category   ▆▆▆▄▂              │  CSS bars
├──────────────────────────────────────┤
│ Recent Expenses   [filter: vendor▾]    │  table, newest first, edit/delete
└──────────────────────────────────────┘
```

- **Styling:** one `style.css`; system font stack; neutral palette with one accent;
  cards = subtle border + radius; tables responsive (horizontal scroll on narrow screens).
- **No chart library:** category bars are `<div>`s with width = `pct%`.
- **Feedback:** toast/inline message area for success/errors.

## 7. Error Handling

| Condition | Function response | UI behavior |
|-----------|-------------------|-------------|
| Missing/invalid PIN | 401 | clear `sessionStorage` PIN, re-prompt |
| Validation fail | 400 + message | inline red message near form |
| Blobs read/write error | 500 | "Could not save, try again" |
| Resend failure | still 200, `emailSent:false` | subtle "email not sent" note |
| Network error (fetch) | — | "Network error" message, data unchanged |

## 8. Security

- PIN never shipped in client code; compared only server-side against `APP_PIN` env var.
- Reads are public (data is non-sensitive expense tracking for a single owner); writes gated.
- No secrets in the repo; all via Netlify environment variables.
- `EMAIL_TO`/`EMAIL_FROM`/`RESEND_API_KEY`/`APP_PIN` injected at runtime.

## 9. File / Folder Structure

```
NewENTV/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   └── lib/calc.js
├── netlify/functions/
│   ├── get-data.js
│   ├── save-vendor.js
│   └── add-expense.js
├── tests/calc.test.js
├── netlify.toml
├── package.json
├── vitest.config.js
├── .gitignore
├── README.md
└── docs/
    ├── 01-requirements.md
    ├── 02-design.md
    └── 03-deploy-netlify.md
```

## 10. Configuration

- `netlify.toml`: `[build] publish = "."`, `functions = "netlify/functions"`;
  redirect `/api/*` → `/.netlify/functions/:splat`.
- `package.json`: deps `@netlify/blobs`, `resend`; devDep `vitest`; scripts `test`, `dev`.
- Node 18+ runtime (Netlify default) — native `fetch`, ES modules.

---

## 11. v2 Design Addendum — Premium Dashboard

v2 keeps the v1 architecture (static site + Netlify Functions + Blobs + Resend) and the
pure-logic core, and layers a single-page dashboard UI on top. Added one function
(`save-settings`) and an additive `settings` field in the blob.

### 11.1 Module map (frontend)

```
index.html              app shell: sidebar + topbar + <main id="view"> + mobile tabbar
css/style.css           design tokens (light/dark), components, responsive, motion
js/app.js               bootstrap: hash router, theme, PIN wiring, nav; subscribes to store
js/store.js             central state + API calls + PIN; emits to subscribers on change
js/lib/
  calc.js               pure math (extended; unit-tested)      ← single source of truth
  categories.js         stage metadata: id, label, icon, color (frontend constant)
  seed.js               owner's real 38 expenses + 7 vendors (first-load seed)
js/ui/                  render-only (data in → HTML/DOM out), no business math
  icons.js              inline SVG icon set (Lucide-style)
  components.js         kpiCard, chartCard, badges, toast, confirmDialog, openDrawer…
  charts.js             Chart.js wrappers (bar/donut/line); destroy-before-recreate
js/views/               render-only view modules, each reads the store
  dashboard.js          6 KPIs + 3 charts + recent-5 preview
  expenses.js           All-Expenses list: search/filter/sort/date-range + edit/delete
  vendors.js            vendor cards + CRUD drawer (lumpsum balances)
  settings.js           budget + PIN + theme
  expense-drawer.js     shared add/edit expense drawer (used by dashboard + expenses)
```

### 11.2 Data flow (unidirectional)

```
user action → view handler → store.saveX() → POST /api/* (PIN header)
            → function read-modify-write blob → returns publicView
            → store.setState() → emit() → app.js re-renders current view
```

Views never mutate state directly or do network I/O; they call store actions and re-render
from `getState()`. `app.js` subscribes once and re-renders the active route on every emit,
so KPIs and charts update live after any add/edit/delete.

### 11.3 Routing

Hash router (`#/dashboard`, `#/expenses`, `#/vendors`, `#/settings`). On navigation,
`destroyAllCharts()` runs first to avoid Chart.js canvas leaks, then the matched view
renders into `#view`. Active nav link gets `.active` + `aria-current="page"`.

### 11.4 Theme

`data-theme` on `<html>` drives the token set. Choice stored in `localStorage` (`cet_theme`);
`system` (default) removes the key and follows `prefers-color-scheme`, with a live
`matchMedia` listener. Charts re-read CSS variables on each render, so theme changes recolor
them automatically.

### 11.5 Backend delta

- **`save-settings.js`** — POST `{ settings: { budget } }`, PIN-gated, validates non-negative
  number, writes `data.settings.budget`, returns `publicView`.
- **`_shared.js`** — `loadData()` returns `buildSeed()` on empty blob; backfills
  `settings`/`seq` for old blobs. `publicView()` includes `settings`.
- **`add-expense.js`** — email snapshot now includes `budget` + `remaining`
  (`budgetRemaining`); email still never blocks the save.

### 11.6 Graceful degradation & accessibility

- Chart.js via CDN; if it fails, `chartsAvailable()` is false and the dashboard shows a note
  instead of charts — totals/tables/forms still work.
- Focus-trapped drawer + confirm dialog, Esc to close, focus returns to trigger. 44px touch
  targets, visible focus rings, `prefers-reduced-motion` collapses transitions.

---

## 12. Addendum — GOOD-file parity features (2026-10-28)

### 12.1 Pure logic (`js/lib/calc.js`, TDD)
- `categoryBudgetRows(expenses, categoryBudgets)` → `[{category, budget, spent, balance, pct}]`
  sorted by spend; `pct` clamped 0–100, `balance` may be negative. Drives Settings inputs,
  Dashboard bars, and the Reports category table.
- `vendorTotals`, `monthlyReport`, `paymentModeTotals` — feed the three Reports tables.
- `filterSortExpenses` haystack extended to include `reference`.

### 12.2 Backend
- **`save-settings.js`** — now accepts optional `settings.budget` **and/or**
  `settings.categoryBudgets` (object of category→number, each validated finite ≥ 0; zero/blank
  values dropped). Fields are merged independently so saving one never clobbers the other.
- **`add-expense.js`** — `sanitizeExpense()` adds `reference: String(e.reference||'').trim()`.
- **`_shared.js`** — `loadData()` backfills `settings.categoryBudgets: {}`; `publicView()` includes
  it.
- **`restore-data.js`** (new, PIN-gated) — accepts `{vendors, expenses, settings}`, sanitizes and
  **replaces** all three wholesale, then resets `seq.vendor`/`seq.expense` past the highest imported
  `v_N`/`e_N` id so later adds never collide. Returns `publicView`. Keeps the blob authoritative and
  multi-device (unlike the GOOD file's localStorage restore).

### 12.3 Frontend
- **`store.js`** — `saveCategoryBudgets(map)`, `exportData()` (client-only snapshot, no secrets/seq),
  `restoreData(doc)` (→ `restore-data`). State `settings` default now `{budget:0, categoryBudgets:{}}`.
- **Settings** — "Stage / Category Budgets" card (one number input per category) and a "Data Safety"
  card (Download backup via `Blob`+`URL.createObjectURL`; Restore via `<input type=file>` → parse →
  `confirmDialog` → `restoreData`).
- **Dashboard** — "Budget vs Actual" section rendering `budgetBar()` rows for budgeted categories.
- **Reports view** (`js/views/reports.js`, route `#/reports`, 5th nav slot) — KPI row + three tables
  + "Print / Save PDF" (`window.print()`); `@media print` hides sidebar/topbar/tabbar/buttons.
- **`components.js`** `budgetBar({label, spent, budget, pct})` — track + fill with `.warn`/`.over`
  state classes.
- **Expense drawer / table** — optional Reference input; `Ref: …` sub-line; searchable.
- **Out of scope:** bill-photo upload.

---

*Next: Phase 3 — Code.*
