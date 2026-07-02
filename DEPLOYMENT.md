# 🚀 Deploying Flavourly OS to Vercel

This guide walks you through deploying Flavourly OS to Vercel, step by step.

---

## Prerequisites

You need:
- A **GitHub account** (your repo is already there: `Naha1981/flavourly-z`)
- A **Vercel account** (free at [vercel.com](https://vercel.com) — sign up with GitHub)
- Your **Supabase credentials** (already configured)
- Your **Evolution API credentials** (already configured)

---

## Step 1: Import your repo to Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub
2. Click **"Add New…" → "Project"**
3. You'll see a list of your GitHub repos. Find **`flavourly-z`** and click **"Import"**
4. Vercel auto-detects Next.js — you don't need to change any build settings

---

## Step 2: Add Environment Variables

On the "Configure Project" page (before you click Deploy), scroll down to **"Environment Variables"**.

Add **each** of these one by one. For each one:
- Type the **Key** name
- Paste the **Value**
- Leave "Environments" as all three (Production, Preview, Development)
- Click **"Add"**

### Required variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Supabase transaction pooler URL (port 6543) — from your `.env` file |
| `DIRECT_URL` | Your Supabase session pooler URL (port 5432) — from your `.env` file |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zzgnspcychbcylsqegwl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key — from your `.env` file |
| `SUPABASE_SECRET_KEY` | Your Supabase secret key — from your `.env` file |
| `NEXTAUTH_URL` | `https://YOUR-APP-NAME.vercel.app` (see note below) |
| `NEXTAUTH_SECRET` | Your NextAuth secret — from your `.env` file |
| `EVOLUTION_API_URL` | `https://bankbook-whatsapp-my-evolution-api.onrender.com` |
| `EVOLUTION_GLOBAL_API_KEY` | Your Evolution API global key — from your `.env` file |
| `EVOLUTION_INSTANCE_NAME` | `Flavourly-os` |
| `EVOLUTION_INSTANCE_TOKEN` | Your Evolution API instance token — from your `.env` file |
| `PAYFAST_MODE` | `sandbox` |
| `APP_URL` | Leave empty — Vercel auto-detects from `VERCEL_URL` |

> 💡 **Tip:** The easiest way is to copy each value from your local `.env` file. Open it at `/home/z/my-project/.env` and copy-paste each value into Vercel.

### ⚠️ About NEXTAUTH_URL:

You need to know your Vercel URL **before** deploying. Here's the trick:
- Vercel assigns a URL like `flavourly-z.vercel.app` or `flavourly-z-xyz.vercel.app`
- **First deploy WITHOUT setting NEXTAUTH_URL** (just skip it)
- After deploy, Vercel shows you your URL (e.g. `https://flavourly-z.vercel.app`)
- Go to **Settings → Environment Variables** and add `NEXTAUTH_URL` = `https://flavourly-z.vercel.app`
- Go to **Deployments** → click the **⋮** next to the latest → **Redeploy**

---

## Step 3: Deploy

1. Click **"Deploy"**
2. Wait ~2-3 minutes for the build to complete
3. You'll see 🎉 confetti when it's done!
4. Click **"Visit"** to open your live app

---

## Step 4: Test your live app

1. **Log in** as `mike@mikescarwash.co.za` / `demo1234` — should work ✅
2. Go to **Settings → WhatsApp** — you should see a real QR code from Evolution API
3. The **Live Activity** feed will show "Live · Polling" (WebSocket mini-service doesn't run on Vercel, so it falls back to 15s REST polling — still works!)

---

## Step 5: Update Evolution API webhook

Now that you have a public Vercel URL, update the webhook in Evolution Manager:

1. Go to your **Evolution Manager**: https://bankbook-whatsapp-my-evolution-api.onrender.com/manager
2. Find the **Flavourly-os** instance → **Webhook settings**
3. Set the webhook URL to:
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/webhooks
   ```
4. Subscribe to events: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`
5. Save

Now real WhatsApp messages from customers will flow into your app! 🎉

---

## Step 6: Connect your WhatsApp number

1. Open your live Vercel app
2. Log in as Mike
3. Go to **Settings → WhatsApp → Connect**
4. Scan the QR with your phone (WhatsApp → Linked Devices → Link a Device)
5. Text `JOIN` to your WhatsApp number from another phone
6. Watch the customer appear in the CRM + activity feed!

---

## 🔧 About the WebSocket realtime service

The realtime WebSocket mini-service (`mini-services/realtime-service/`) **cannot run on Vercel** because Vercel is serverless (no persistent processes).

**The app handles this automatically:**
- The dashboard tries to connect to the WebSocket for 3.5 seconds
- If it fails (which it will on Vercel), it falls back to **REST polling** every 15 seconds
- The badge shows **"Live · Polling"** instead of "Live"
- All functionality works identically — just with a 15s delay instead of 2s

If you want true realtime on Vercel, you'd need to deploy the mini-service separately (e.g. on Railway, Render, or Fly.io) and update the `XTransformPort` connection. But for most use cases, 15s polling is perfectly fine.

---

## 🆘 Troubleshooting

### Build fails with Prisma error
Make sure `DATABASE_URL` and `DIRECT_URL` are set correctly in Vercel env vars. The `postinstall` script runs `prisma generate` automatically.

### Login doesn't work
Make sure `NEXTAUTH_URL` is set to your exact Vercel URL (including `https://`). If you see redirect loops, it's usually this.

### WhatsApp QR doesn't load
Make sure `EVOLUTION_API_URL`, `EVOLUTION_GLOBAL_API_KEY`, `EVOLUTION_INSTANCE_NAME`, and `EVOLUTION_INSTANCE_TOKEN` are all set. Check the Vercel function logs.

### Database connection errors
Make sure you're using the **pooler** URLs (port 6543 for DATABASE_URL, port 5432 for DIRECT_URL), not the direct connection string. Supabase free tier requires the pooler for serverless functions.

### Need to redeploy after env var changes?
Go to **Deployments** → click **⋮** on the latest → **Redeploy**. Or just push a new commit to GitHub — Vercel auto-deploys on every push.
