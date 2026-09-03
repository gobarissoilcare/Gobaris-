# Gobaris server

A small Express API that creates Razorpay orders, verifies payments, and
stores each order in Postgres. This is what the "Checkout" button in
`index.html` talks to.

## What you need before deploying

1. **A Razorpay account** — sign up at [razorpay.com](https://razorpay.com).
   You can get **Test Mode** API keys immediately (Dashboard → Settings →
   API Keys) without completing KYC, so you can test the whole flow first.
   KYC is only required to switch to **Live Mode** and accept real payments.
2. **A Render account** — sign up at [render.com](https://render.com) (free
   to start).

## Deploy steps (Render)

1. **Push this repo to GitHub** (already done) so Render can pull from it.
2. In Render: **New → PostgreSQL**. Create a free/starter database. Copy
   its **Internal Database URL** once it's ready.
3. In Render: **New → Web Service** → connect this GitHub repo.
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under the new Web Service's **Environment** tab, add:
   - `DATABASE_URL` — the Postgres URL from step 2
   - `RAZORPAY_KEY_ID` — from your Razorpay dashboard (start with the `rzp_test_...` one)
   - `RAZORPAY_KEY_SECRET` — from your Razorpay dashboard
   - `ALLOWED_ORIGINS` — `https://gobarissoilcare.github.io,http://localhost:8098`
     (add your custom domain here too once you have one)
5. Deploy. Render will give you a URL like `https://gobaris-server.onrender.com`.
6. Open [`../index.html`](../index.html), find this line near the shop script:
   ```js
   const API_BASE = 'https://YOUR-RENDER-SERVICE.onrender.com';
   ```
   and replace it with your actual Render URL. Commit and push — the site's
   checkout will switch itself from "Preview" mode to live automatically
   once this points at a real backend.

## Testing before going live

With `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` set to your **Test Mode** keys,
the checkout flow works end-to-end but no real money moves — Razorpay gives
you [test card/UPI numbers](https://razorpay.com/docs/payments/payments/test-mode/)
for this. Switch to Live Mode keys (after Razorpay approves your KYC) when
you're ready to accept real customer payments.

## Local development

```bash
cd server
cp .env.example .env   # fill in your own values
npm install
npm start
```

The API runs on `http://localhost:4000` by default.

## What gets stored

Each order in the `orders` table has the customer's name, phone, address,
the items and quantities ordered, the amount charged, and the payment
status (`created` → `paid`). There's no admin UI yet — for now, query the
database directly (Render's dashboard has a built-in SQL shell), or ask to
have a simple orders-list page added later.
