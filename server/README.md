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
   - `ALLOWED_ORIGINS` — `https://gobaris.com,https://www.gobaris.com,https://gobarissoilcare.github.io,http://localhost:8098`
   - `GOOGLE_CLIENT_ID` and `SESSION_SECRET` — for the admin panel, see
     [Admin panel](#admin-panel) below
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

## Admin panel

[`gobaris.com/admin`](../admin/index.html) is where the team runs the
website without touching code:

| Section | What it does |
|---|---|
| **Orders** | Paid shop orders: customer, address, packs, amount. Mark each New → Packed → Shipped → Delivered (or Cancelled), add a note such as a tracking number, and download the list for Excel. |
| **Enquiries** | Every message from the "Get in touch" form, saved even if the visitor never presses send in WhatsApp. Mark as replied or closed. |
| **Shop & prices** | Price, offer price, stock and description of each pack, or hide a pack. Checkout charges these prices, and stock goes down by itself when an order is paid. |
| **Blog posts** | Write, edit, publish and delete posts, including the five original articles. |
| **Website text** | Announcement bar, home page headline, shop intro, cow welfare section. |
| **Contact details** | The contact person, phone, WhatsApp number and email in the footer. Enquiries go to this WhatsApp number. |
| **Cow facts** | The facts the little cow pops up with. |
| **Founders** | The founder cards on the About page. |
| **Admins** | Who can sign in, grouped as Analysts, Admins and Executives. |

The website keeps the text written into `index.html` as a fallback, so it
looks the same as before if the server can't be reached. On a brand-new
database the server fills in the four packs (from [`products.js`](products.js))
and the five original blog posts (from [`seed-posts.js`](seed-posts.js)) the
first time it starts.

Admins sign in with their Google account. **The core team in
[`admins.js`](admins.js) can always get in and can't be removed from the
panel**. Everyone has the same permissions; the role is just a label:

- Harsh Chittoudiya (Admin): chittoudiyaharsh.2602@gmail.com
- Dr. Aditi Gupta (Admin): aditi08041998@gmail.com
- Ayush Upadhyay (Analyst): ayushupadhyay161@gmail.com

Anyone else can be given access on the panel's **Admins** page as an
**Analyst**, **Admin** or **Executive** (the page groups people in that
order, and their role can be changed later). While the
Google app is in "Testing" mode, also add their email under Google Cloud →
Google Auth Platform → Audience → **Test users**. The check happens on this
server: every change an admin makes is re-checked against the list, so
removing someone locks them out straight away.

### One-time Google setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and
   create a project (e.g. "Gobaris").
2. **APIs & Services → OAuth consent screen**: pick **External**, app name
   "Gobaris Admin", and your email as the support and developer contact.
   No extra scopes are needed. Then either **publish the app** or add the
   three admin emails under **Test users**. Until you do one of these,
   Google blocks the sign-in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `https://gobaris.com`,
     `https://www.gobaris.com`, and `http://localhost:8098` (and
     `http://localhost`) for testing on your own computer
   - No redirect URIs are needed.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`) into
   the Render service's environment as `GOOGLE_CLIENT_ID`.
5. Also add `SESSION_SECRET`: any long random string. Generate one with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   It keeps admins signed in (for 12 hours) across server restarts.
6. Make sure `ALLOWED_ORIGINS` includes `https://gobaris.com`, then redeploy.

### API

| | |
|---|---|
| `GET /api/posts` | Published posts, for the website's Blog page |
| `GET /api/posts/:slug/cover` | A post's cover image |
| `GET /api/admin/config` | The Google Client ID and the names of the admins |
| `POST /api/admin/login` | Exchanges a Google sign-in for a 12-hour admin session |
| `GET /api/site` | Website text, cow facts, founders and shop packs, for the website |
| `POST /api/enquiries` | Saves a "Get in touch" enquiry |
| `GET/POST /api/admin/posts`, `PUT/DELETE /api/admin/posts/:id` | Manage posts |
| `GET /api/admin/products`, `PUT /api/admin/products/:id` | Packs, prices and stock |
| `GET /api/admin/orders`, `PUT /api/admin/orders/:id`, `GET /api/admin/orders.csv` | Orders and their delivery status |
| `GET /api/admin/enquiries`, `PUT/DELETE /api/admin/enquiries/:id` | Enquiries |
| `GET /api/admin/content`, `PUT /api/admin/content/:key` | Website text (`site`), `facts`, `founders` |
| `GET/POST /api/admin/admins`, `PUT/DELETE /api/admin/admins/:email` | Who can sign in, and their role |

Everything under `/api/admin/` needs `Authorization: Bearer <session>`.

New admin sections go in the same way: add routes protected by
`requireAdmin` from `auth.js`, and a section in `admin/index.html`.

## What gets stored

Each order in the `orders` table has the customer's name, phone, address,
the items and quantities ordered, the amount charged, the payment status
(`created` → `paid`) and the delivery status (`new` → `packed` → `shipped`
→ `delivered`). Orders are listed in the admin panel's **Orders** section.
The rest of the admin panel's data lives in the `posts`, `products`,
`settings`, `enquiries` and `admins` tables.
