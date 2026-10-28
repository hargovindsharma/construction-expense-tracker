# 🏗️ Kamal Kunj Expense Tracker

A single-page web app to track construction project expenses **from any device**, with an
**email sent to you on every expense** (snapshot + last 5 entries). Free to host on Netlify.
**No database** — data lives in Netlify Blobs.

## Features
- **Total spent**, this-month spend, vendor count, and **outstanding lumpsum balance** KPIs.
- **Vendors** with rate type (per sq.ft / lumpsum / daily / hourly) and agreed total.
- **Vendor-wise expenses**, category breakdown, recent-expenses list with filter.
- **Email on each new expense** → `hargovindsharma@gmail.com` (via Resend).
- **PIN-protected** writes; anyone can be stopped from editing without the PIN.
- **Responsive** — works on phone, tablet, laptop, desktop; dark-mode aware.

## Tech
- Frontend: plain HTML + CSS + vanilla JS (no framework, no build step).
- Backend: Netlify Functions (`get-data`, `save-vendor`, `add-expense`).
- Storage: Netlify Blobs (`data.json`). Email: Resend.

## Project layout
```
index.html              Single page UI
css/style.css           Responsive styles (mobile-first, dark-mode aware)
js/app.js               UI controller
js/lib/calc.js          Pure logic (unit-tested, shared with functions)
netlify/functions/      get-data · save-vendor · add-expense · _shared
tests/calc.test.js      Vitest unit tests
docs/                   01 requirements · 02 design · 03 deploy guide
netlify.toml            Functions + /api/* redirect
```

## Setup / deploy
See **[docs/03-deploy-netlify.md](docs/03-deploy-netlify.md)** for a full beginner guide.
Quick version:
1. Push this folder to a GitHub repo.
2. Netlify → *Add new site → Import from GitHub* → deploy.
3. Set environment variables: `APP_PIN`, `RESEND_API_KEY`, `EMAIL_TO`, `EMAIL_FROM`.
4. Open your `*.netlify.app` URL, enter the PIN, add a vendor, add an expense.

## Local dev (optional, needs Node 18+)
```bash
npm install
npm test        # unit tests
npm run dev     # netlify dev at http://localhost:8888
```

## Docs
- [Requirements (SRS)](docs/01-requirements.md)
- [Design (SDD)](docs/02-design.md)
- [Netlify deploy guide](docs/03-deploy-netlify.md)
