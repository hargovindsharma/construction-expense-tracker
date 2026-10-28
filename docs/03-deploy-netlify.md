# 03 — Deploying to Netlify (beginner step-by-step)

This guide assumes you have **never used Netlify before**. Follow it top to bottom. It takes
about 20–30 minutes. Everything here is **free**.

> **What you'll end up with:** a web link (e.g. `https://your-site.netlify.app`) you can open
> on any phone, tablet, or computer to add expenses — and an email to
> **hargovindsharma@gmail.com** every time you add one.

---

## Part A — Create your free accounts (one time)

### A1. Netlify account
1. Go to **https://www.netlify.com** → click **Sign up**.
2. Sign up with your **GitHub** account (easiest — recommended) or email.
3. That's it. The free "Starter" plan is enough.

### A2. Resend account (for the emails)
1. Go to **https://resend.com** → **Sign up** (free: 100 emails/day, 3,000/month).
2. After login, open **API Keys** (left menu) → **Create API Key** → name it
   `expense-tracker` → **copy the key** (looks like `re_xxxxxxxx`). Keep it somewhere safe —
   you'll paste it into Netlify later. You won't be able to see it again.
3. **Sender address — pick ONE:**
   - **Easiest for testing:** use Resend's shared sender `onboarding@resend.dev`. No setup.
     (Emails may land in spam, and you can only send to your own verified address at first.)
   - **Best (recommended):** if you own a domain, open **Domains** → **Add Domain**, follow
     the DNS steps, then use something like `expenses@yourdomain.com`.
   - If you don't have a domain, start with `onboarding@resend.dev` and upgrade later.
4. In Resend, go to **Audiences / Verified** and make sure **hargovindsharma@gmail.com** is
   allowed as a recipient (on the free sandbox you must verify the recipient; with a verified
   domain you can send to anyone).

---

## Part B — Get the project onto Netlify

You have two ways. **Method 2 (GitHub) is recommended** because future updates auto-deploy.

### Method 1 — Drag & drop (fastest, but no auto-updates)
> ⚠️ Drag-and-drop does **not** install the server dependencies the functions need. Use this
> only for a quick look at the page; for the **working app with email + storage**, use
> Method 2.

### Method 2 — Connect a GitHub repo (recommended) ✅

**B1. Put the project on GitHub**
1. Create a free GitHub account if you don't have one (**https://github.com**).
2. Create a new repository (e.g. `construction-expense-tracker`), **Private** is fine.
3. Upload the project:
   - **Easy way (web):** on the new empty repo page, click **uploading an existing file**,
     then drag in the whole `NewENTV` folder contents (all files and folders — `index.html`,
     `css/`, `js/`, `netlify/`, `docs/`, `package.json`, `netlify.toml`, etc.). Commit.
   - **Or with git** (if you have it):
     ```bash
     cd NewENTV
     git init
     git add .
     git commit -m "Construction expense tracker"
     git branch -M main
     git remote add origin https://github.com/<you>/construction-expense-tracker.git
     git push -u origin main
     ```

**B2. Import into Netlify**
1. In Netlify, click **Add new site** → **Import an existing project**.
2. Choose **GitHub**, authorize, and pick your repository.
3. Build settings (Netlify usually auto-detects from `netlify.toml`):
   - **Build command:** leave empty (no build step).
   - **Publish directory:** `.`
   - **Functions directory:** `netlify/functions` (from `netlify.toml`).
4. Click **Deploy**. Wait ~1 minute.

---

## Part C — Set your secret settings (environment variables)

The app needs 4 settings. **These are secret — never put them in the code.**

1. In your Netlify site, go to **Site configuration → Environment variables → Add a variable**.
2. Add these four (key → value):

   | Key | Value | What it is |
   |-----|-------|-----------|
   | `APP_PIN` | a number/word only you know, e.g. `4821` | the PIN to add/edit data |
   | `RESEND_API_KEY` | the `re_...` key from Resend | lets the app send email |
   | `EMAIL_TO` | `hargovindsharma@gmail.com` | who gets the email |
   | `EMAIL_FROM` | `onboarding@resend.dev` (or your verified sender) | who the email is from |

3. After adding them, go to **Deploys → Trigger deploy → Deploy site** so the new settings
   take effect.

---

## Part D — Open and test your site

1. Netlify shows your URL at the top, e.g. `https://melodic-tarsier-123.netlify.app`
   (you can rename it under **Site configuration → Change site name**).
2. Open it on your **laptop**:
   - Type your **PIN** (top right). You should see a green ✓.
   - Open **Add / Manage Vendor**, add a vendor (e.g. Ramesh, Masonry, Lumpsum, agreed
     ₹5,00,000). Save.
   - Add an **expense** for that vendor (e.g. ₹2,00,000 today). Save.
   - Check: KPI cards update, Vendor Summary shows balance ₹3,00,000, and an **email arrives**
     at hargovindsharma@gmail.com (check spam the first time).
3. Open the **same URL on your phone** → you should see the same data. 🎉 That proves it works
   from anywhere.

---

## Part E — Troubleshooting

| Problem | Fix |
|---------|-----|
| "Wrong PIN" | The PIN you typed must exactly match `APP_PIN` in Netlify env vars. Re-check, re-deploy. |
| No email arrived | Check spam. Confirm `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` are set and you re-deployed. On Resend sandbox, verify the recipient address. |
| "Could not save" | Open Netlify **Logs → Functions** to see the error. Usually a missing env var. |
| Page loads but nothing saves | Make sure you deployed via **GitHub (Method 2)**, not drag-and-drop, so functions + dependencies exist. |
| Email says "not sent" but expense saved | That's by design — your data is safe; only the email failed. Fix the Resend settings and future adds will email. |

**Where are the logs?** Netlify site → **Logs** (top nav) → **Functions**. Click a function
(`add-expense`) to see `console.error` messages.

---

## Part F — Making changes later

- **With GitHub (Method 2):** edit a file on GitHub (or push with git) → Netlify
  **auto-deploys** in ~1 minute. Nothing else to do.
- **Change the PIN / email:** just edit the environment variable in Netlify and
  **Trigger deploy**.

---

## (Optional) Run it on your own computer first

If you want to test before deploying, and you have **Node.js 18+** installed:

```bash
cd NewENTV
npm install
npm test            # runs the unit tests — should all pass
npm run dev         # starts Netlify Dev at http://localhost:8888
```

For `npm run dev` to send real emails locally, create a `.env` file (NOT committed) with:

```
APP_PIN=4821
RESEND_API_KEY=re_xxxxxxxx
EMAIL_TO=hargovindsharma@gmail.com
EMAIL_FROM=onboarding@resend.dev
```

> Don't have Node.js? Download the **LTS** version from https://nodejs.org. This local step
> is optional — you can deploy straight to Netlify without it.
