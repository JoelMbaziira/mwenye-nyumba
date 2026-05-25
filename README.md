# Mwenye Nyumba

Rent reminders, sent right. A landlord-facing web app to register tenants, send invoice emails, and track payments. Mobile-money payment is **simulated** for the demo — no real money moves.

Built with Next.js 14, Supabase (auth + Postgres + RLS), Resend (email), Tailwind, and shadcn/ui.

---

## What's in here

```
app/                      Next.js App Router pages + API routes
  api/                    REST endpoints (tenants, reminders, payments)
  dashboard/              Landlord dashboard (protected)
  login/, signup/         Auth pages
  pay/[id]/               PUBLIC payment page reached from email link
components/               UI components (incl. shadcn primitives in components/ui)
lib/
  supabase/               Browser, server, and middleware Supabase clients
  email.ts                Resend email template
  utils.ts                Formatters + cn helper
supabase/
  schema.sql              SQL to run in Supabase to create tables + RLS + RPCs
middleware.ts             Session refresh + route protection
```

---

## One-time setup

You'll do this once. It takes about 15 minutes.

### 1. Install dependencies

```bash
npm install
```

Requires Node.js 18.17+ (Next.js 14 minimum).

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once it's provisioned, open **SQL Editor** → **New query**.
3. Paste the entire contents of `supabase/schema.sql` and run it. This creates the `tenants` and `invoices` tables, RLS policies, and two `SECURITY DEFINER` functions that let the public payment page work safely without opening the tables to anonymous users.
4. Open **Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Create your Resend account

1. Go to [resend.com](https://resend.com) → sign up.
2. **API Keys → Create API Key** → copy it (starts with `re_`).
3. For the sender:
   - **Quickest:** use Resend's test address `onboarding@resend.dev`. Emails will work immediately but won't be branded with your domain.
   - **Production:** **Domains → Add Domain**, follow the DNS steps, then use something like `reminders@yourdomain.com`.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` to start, or your verified domain |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, your Vercel domain in prod |

### 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, sign up, add a tenant, click **Send reminder**. The email lands in your tenant's inbox with a payment link that opens a public page. Submit the simulated mobile-money form — the dashboard updates instantly with who paid and when.

---

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. In the **Environment Variables** step, add the same five variables from your `.env.local`. **Update `NEXT_PUBLIC_APP_URL` to your Vercel production URL** (e.g. `https://mwenye-nyumba.vercel.app`).
4. Deploy. Vercel will build it and give you a live URL.

After the first deploy, also add your Vercel domain to **Supabase → Authentication → URL Configuration → Site URL** so email-link redirects work correctly.

---

## How it fits together

- **Auth:** Supabase Auth (email + password). Middleware redirects unauthenticated users away from `/dashboard` and authenticated users away from `/login` and `/signup`.
- **Data:** Two tables — `tenants` and `invoices` — with row-level security so a landlord only sees their own rows. There's a unique constraint on `(tenant_id, period)` to enforce one invoice per tenant per month.
- **Reminder flow:** clicking *Send reminder* finds-or-creates the current month's invoice and emails it through Resend. The email contains a link to `/pay/{invoiceId}` on your deployed domain.
- **Public payment page:** anonymous. The page server-component calls `get_invoice_for_payment(uuid)` — a `SECURITY DEFINER` Postgres function — so the tables themselves remain locked down. Submitting the form calls `pay_invoice(uuid, phone, provider)`, which atomically flips the invoice to paid only if it was unpaid.
- **Dashboard:** server component that joins tenants with their most recent invoice and renders a status table plus summary stats.

---

## What's a demo vs. what's production-ready

The codebase itself is production-quality — typed, RLS-secured, RPC-isolated for public access, real email delivery. The only deliberately simulated piece is the payment step. To turn it real, replace `pay_invoice` with a webhook handler from a mobile-money aggregator (Flutterwave, Pesapal, MTN MoMo Open API, Yo! Payments) that verifies the transaction before marking the invoice paid.

A few other things you'd want before charging real customers:
- Rate-limit `POST /api/reminders` so a landlord can't spam a tenant.
- Add email-confirmation on signup (currently disabled by default in Supabase — turn it on in **Authentication → Providers → Email**).
- Add a basic audit log (who sent which reminder, when).
- Wire a cron (Vercel Cron or Supabase scheduled function) to auto-generate invoices on the 1st of each month and auto-send a reminder.
