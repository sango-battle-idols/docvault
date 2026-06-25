# DocVault — Deploy Guide

Private document viewer with permanent Discord links and auto-renewing 2-day tokens.

---

## How it works

- Each doc gets a **permanent slug link** like `your-site.com/training` — post this in Discord
- When someone visits `/training`, the server checks if the current token is valid
- If the token is **expired or missing**, a fresh 2-day token is **automatically generated**
- The visitor is redirected to `/training?sn=newtoken` seamlessly
- If someone copies the full `?sn=` URL and shares it elsewhere, it shows **"Document Not Found"** after 2 days

---

## Step 1 — Push to GitHub

1. Go to https://github.com, create a free **private** repo named `docvault`
2. In a terminal inside this folder:

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/docvault.git
git push -u origin main
```

---

## Step 2 — Deploy to Vercel

1. Go to https://vercel.com, sign up free with GitHub
2. Click **Add New Project** → select `docvault` → click **Deploy**

---

## Step 3 — Create an Upstash Redis database

1. In your Vercel project dashboard, click the **Storage** tab
2. Click the arrow next to **Upstash** → **Create Database**
3. Choose **Redis**, name it anything (e.g. `docvault`), pick a region close to you → **Create**
4. Click **Connect to Project** and select your `docvault` project
5. Vercel will automatically add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   to your environment variables — you don't need to copy anything manually

---

## Step 4 — Set your own Environment Variables

In Vercel: **Settings → Environment Variables** — add these two:

| Name           | Value                                               |
|----------------|-----------------------------------------------------|
| `ADMIN_SECRET` | A password you make up (keep it private)            |
| `SITE_URL`     | Your Vercel URL, e.g. `https://docvault.vercel.app` |

After adding, go to **Deployments** → three dots on latest deploy → **Redeploy**.

---

## Step 5 — Prepare your Google Docs

For **each** document:
1. Open it in Google Docs
2. **Share → Anyone with the link → Viewer**
3. Copy the Doc ID from the URL: `docs.google.com/document/d/`**`COPY_THIS`**`/edit`

---

## Step 6 — Register your documents

1. Go to `https://your-site.vercel.app/admin.html`
2. Enter a **slug** (e.g. `training`), the **Doc ID**, and your **Admin Secret**
3. Click **Generate Link**
4. Copy the **Permanent Link** and post it in Discord

Repeat for each document with a different slug.

---

## That's it — fully automatic from here

- Tokens auto-renew every 2 days when anyone visits the permanent link
- You never need to touch the admin page again unless you're adding a new doc
- Old `?sn=` URLs shared outside your server stop working after 2 days

---

## What's blocked / allowed

| Action              | Status              |
|---------------------|---------------------|
| Text selection      | ✅ Allowed          |
| Right-click         | ✅ Allowed          |
| Ctrl+C (copy)       | ✅ Allowed          |
| Ctrl+P (print)      | ✅ Allowed          |
| Ctrl+S (save)       | 🚫 Blocked          |
| Ctrl+A (select all) | 🚫 Blocked          |
| Expired ?sn= URL    | 🚫 "Document Not Found" |

---

## File structure

```
docvault/
├── api/
│   ├── generate.js   ← registers a slug+doc and issues first token
│   ├── redirect.js   ← looks up / auto-renews token for a slug
│   └── doc.js        ← validates token and serves doc content
├── public/
│   ├── index.html    ← document viewer and router
│   └── admin.html    ← your document management page
├── vercel.json
└── package.json
```
