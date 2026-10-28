# 01 — Software Requirements Specification (SRS)

**Project:** Construction Expense Tracker
**Owner:** Hargovind Sharma
**Date:** 2026-10-28
**Status:** Draft for review

---

## 1. Purpose

Provide a single, clean web application to **track and update construction project expenses
from any device**, giving an at-a-glance view of total spend, per-vendor spend, and
remaining balances, with an **email notification sent on every expense entry**.

## 2. Scope

A single-page web app hosted free on Netlify. Data is stored centrally in **Netlify Blobs**
(no traditional database). Writes are protected by a shared **PIN**. On each new expense, an
email is sent to **hargovindsharma@gmail.com** with the latest snapshot and the last 5
entries.

**In scope:** vendor management, expense entry, live totals/KPIs, lumpsum balance tracking,
email-on-add, PIN-gated writes, mobile + desktop access.

**Out of scope:** receipt/photo uploads, multi-user roles, full authentication, offline
mode, payment integration, multi-project support, data export (may be future work).

## 3. Actors

| Actor | Description |
|-------|-------------|
| **Admin (you)** | The only user. Adds/edits vendors and expenses from phone or laptop. Holds the PIN. |
| **Email recipient** | hargovindsharma@gmail.com — receives a notification per expense. (Same person, but listed separately as a system output.) |

## 4. Functional Requirements

### Vendors
- **FR-1 — Add vendor.** Capture: name, category, phone (optional), rate type
  (`per_sqft` / `lumpsum` / `daily` / `hourly`), rate value, agreed total (for lumpsum),
  notes, status (`active`/`done`). Name + category required.
- **FR-2 — Edit vendor.** Modify any field of an existing vendor.
- **FR-3 — Delete vendor.** Remove a vendor. If the vendor has expenses, warn before delete
  (expenses are retained but shown as "unknown vendor" — see FR-13).
- **FR-4 — List vendors.** Show a Vendor Summary table: name, category, rate, agreed total,
  paid-so-far, balance (lumpsum), % complete, status.

### Expenses
- **FR-5 — Add expense.** Capture: date (default today), vendor (dropdown), amount,
  category (auto-filled from vendor, editable), payment mode (`cash`/`UPI`/`bank`),
  description (optional). Vendor + amount + date required; amount > 0.
- **FR-6 — Edit expense.** Modify any field of an existing expense.
- **FR-7 — Delete expense.** Remove an expense.
- **FR-8 — List expenses.** Recent Expenses table, newest first, filterable by vendor.

### Dashboard / KPIs (all derived, never stored)
- **FR-9 — Total Spent.** Sum of all expense amounts.
- **FR-10 — This Month.** Sum of expenses in the current calendar month.
- **FR-11 — Vendor count.** Number of vendors (optionally active only).
- **FR-12 — Outstanding balance.** Sum over lumpsum vendors of `max(agreedTotal − paid, 0)`.
- **FR-13 — Spend by category.** Totals grouped by category, shown as simple bars.

### Email
- **FR-14 — Email on add.** On every successful expense **add**, send one email to the
  configured recipient. (Edits/deletes do not email, to avoid noise — configurable later.)
- **FR-15 — Email content.** Subject includes amount. Body includes: the new expense line, a
  **snapshot** (total spent, this month, vendor count, outstanding balance), and the
  **last 5 expense entries** (date, vendor, category, amount).
- **FR-16 — Email resilience.** If email sending fails, the expense is still saved; the
  failure is logged, not surfaced as a save error.

### Access control
- **FR-17 — PIN gate on writes.** All add/edit/delete operations require a correct PIN,
  verified server-side. Reads (viewing the dashboard) are open.
- **FR-18 — PIN entry.** PIN entered once per session (stored in `sessionStorage`), sent as
  a request header on every write. Wrong PIN → operation rejected with a clear message.

## 5. Non-Functional Requirements

- **NFR-1 — Cost.** Must run entirely on free tiers (Netlify + Resend).
- **NFR-2 — No database.** Storage via Netlify Blobs only.
- **NFR-3 — Accessible from anywhere.** Central storage; same data on every device.
- **NFR-4 — Mobile-first.** Primary use is adding expenses on-site from a phone.
- **NFR-5 — Clean & simple.** No visual clutter; fast to load; no heavy frameworks.
- **NFR-6 — Accuracy.** All derived figures computed from source data at render time; no
  duplicated/stored aggregates that can drift.
- **NFR-7 — Resilience.** A single JSON blob; writes read-modify-write the whole document.
- **NFR-8 — Currency.** Indian Rupee (₹), formatted with `en-IN` grouping.

## 6. Data Dictionary

### Vendor
| Field | Type | Notes |
|-------|------|-------|
| id | string | generated, `v_<counter>` |
| name | string | required |
| category | string | required (e.g. Demolition, Boring, Masonry, Plumbing, Electrical) |
| phone | string | optional |
| rateType | enum | `per_sqft` \| `lumpsum` \| `daily` \| `hourly` |
| rateValue | number | rate amount (₹) |
| agreedTotal | number | lumpsum agreed amount; used for balance |
| notes | string | optional |
| status | enum | `active` \| `done` |

### Expense
| Field | Type | Notes |
|-------|------|-------|
| id | string | generated, `e_<counter>` |
| date | string | `YYYY-MM-DD` |
| vendorId | string | FK → Vendor.id |
| amount | number | > 0, in ₹ |
| category | string | defaults from vendor, editable |
| description | string | optional |
| paymentMode | enum | `cash` \| `UPI` \| `bank` |
| createdAt | string | ISO timestamp |

### Derived (computed, not stored)
| Value | Formula |
|-------|---------|
| Total spent | Σ expense.amount |
| This month | Σ amount where date in current month |
| Vendor paid | Σ amount where expense.vendorId == vendor.id |
| Lumpsum balance | max(vendor.agreedTotal − vendorPaid, 0) |
| % complete (lumpsum) | min(vendorPaid / agreedTotal, 1) × 100 |
| Outstanding total | Σ lumpsum balance over all lumpsum vendors |
| Category totals | group expenses by category, Σ amount |

## 7. Email Specification

- **Trigger:** successful expense add (FR-14).
- **To:** hargovindsharma@gmail.com (env `EMAIL_TO`).
- **From:** Resend-verified sender (env `EMAIL_FROM`).
- **Subject:** `🏗️ New expense — ₹<amount> (<vendor name>)`
- **Body (HTML):**
  - Heading + the new expense: amount, vendor, category, date, payment mode.
  - **Snapshot:** Total Spent, This Month, Vendors, Outstanding.
  - **Last 5 entries** table: Date · Vendor · Category · Amount.

## 8. Acceptance Criteria (traceability)

| # | Given / When / Then |
|---|---------------------|
| AC-1 (FR-1,5) | Given PIN entered, when I add a vendor then an expense, both persist and appear in their tables. |
| AC-2 (FR-9..13) | Given expenses exist, KPI cards and category bars show correct sums. |
| AC-3 (FR-12) | Given a lumpsum vendor with agreed ₹5,00,000 and ₹2,00,000 paid, balance shows ₹3,00,000. |
| AC-4 (FR-14..15) | When I add an expense, an email arrives with snapshot + last 5 entries. |
| AC-5 (FR-16) | Given email provider down, the expense still saves; no error shown to user. |
| AC-6 (FR-17,18) | Given wrong PIN, a write is rejected; reads still work. |
| AC-7 (NFR-3) | Given an expense added on laptop, it is visible on phone after reload. |
| AC-8 (NFR-2,1) | App runs with no database and no paid services. |

---

*Next: Phase 2 — Design (`docs/02-design.md`).*
