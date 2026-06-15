# FYLYMPITCH — Go-Live Guide (≈20 minutes)

Stack: Next.js 15 · TypeScript · Tailwind · Supabase (Postgres + Auth + Storage) · Cloudflare Workers

---

## STEP 1 — Supabase (≈8 min)

1. Go to https://supabase.com/dashboard → **New project** → name it `fylympitch`, choose a strong DB password, region **Mumbai (ap-south-1)** (closest to Kerala users).
2. When the project is ready, open **SQL Editor** → **New query** → paste the ENTIRE contents of `supabase/schema.sql` → **Run**.
   - This creates all 11 tables, every index, all Row Level Security policies, the two private storage buckets (`pitch-decks`, `scripts`), triggers, and seeds 10 real opportunities (Hubert Bals, NFDC Film Bazaar, Sundance, Eurimages, Berlinale WCF, Busan ACF, Doha, Rotterdam Lab, Cannes Producers Network, Visions Sud Est).
3. **Make yourself admin**: sign up once on your deployed site (Step 3), then in SQL Editor run:
   ```sql
   update public.profiles set role = 'admin', approval_status = 'approved'
   where id = (select id from auth.users where email = 'nobinkurian@yahoo.com');
   ```
4. Copy your keys: **Project Settings → API** →
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Never expose the `service_role` key — it is not used by this app.)

### Google Login (optional but recommended)
1. https://console.cloud.google.com → Credentials → **Create OAuth Client ID** (Web application).
2. Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. In Supabase: **Authentication → Providers → Google** → paste Client ID + Secret → Enable.

### Auth URLs (required)
**Authentication → URL Configuration**:
- Site URL: `https://pitch.fylym.com`
- Redirect URLs: add `https://pitch.fylym.com/auth/callback` and `http://localhost:3000/auth/callback`

---

## STEP 2 — Cloudflare Workers (≈7 min)

This app uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) to run Next.js 15 on Cloudflare Workers. The `wrangler.jsonc` and `open-next.config.ts` files are already configured.

### Option A — Cloudflare Dashboard (recommended)
1. Push this repo to GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `.open-next/assets`
4. **Settings → Environment variables**, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Step 1.4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 1.4 |
| `NEXT_PUBLIC_SITE_URL` | `https://pitch.fylym.com` |
| `RESEND_API_KEY` | from resend.com |
| `GROQ_API_KEY` | from console.groq.com |
| `OPENAI_API_KEY` | from platform.openai.com (optional) |
| `CEREBERAS_API` | from cloud.cerebras.ai (optional) |

5. **Save and deploy**.

### Option B — Wrangler CLI
```bash
npm install
npm run deploy   # runs: opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Set secrets via CLI:
```bash
wrangler secret put NEXT_PUBLIC_SUPABASE_URL
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
wrangler secret put NEXT_PUBLIC_SITE_URL
wrangler secret put RESEND_API_KEY
wrangler secret put GROQ_API_KEY
```

### Custom domain
Cloudflare Dashboard → Workers & Pages → `fylympitch` → **Custom Domains** → add `pitch.fylym.com`.
(DNS is managed by Cloudflare automatically if `fylym.com` is on Cloudflare.)

---

## STEP 3 — Smoke test (≈5 min)

1. **Landing page** loads with the FYLYMPITCH wordmark, pricing, FAQ.
2. **Sign up** as a Filmmaker (Google sign-in → onboarding → select Filmmaker) → land on dashboard.
3. **Submit a project** (Dashboard → Projects → New) with a PDF deck/script → see live-ranked matched opportunities on the project page.
4. **Browse opportunities** → save one → apply with the project → it appears in Applications.
5. **Sign up** a second account as Producer → it shows "pending verification".
6. As **admin** (`/admin`): Users → approve the producer → producer can now open **Discover**, read the script via signed link, and **Make an offer**.
7. Back as the filmmaker: the offer appears on the dashboard → **Accept** → producer gets a notification.
8. `/admin` analytics counters all moved. Audit log shows the approval.

If all eight pass, you are live.

---

## Security model (what the audit asked for — all fixed)

- **RLS on every table** (40 policies): users can only read/write their own rows; producers/investors must be `approved` before they can see public projects, open script files, or insert offers — enforced in Postgres, not the browser.
- **Admin checks are server-side**: `/admin` layout verifies `role = 'admin'` from the database on every request; all admin actions re-verify via `requireAdmin()` in server actions. There is no client-side role logic.
- **No localStorage gating** anywhere. Sessions are httpOnly cookies via `@supabase/ssr`.
- **Files are private**: pitch decks and scripts live in private buckets; access is via 1-hour signed URLs, granted only to the owner, approved industry users, and admins (storage policies in schema.sql).
- Users **cannot self-promote** their role (column protected by RLS policy + trigger).

---

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase keys
npm install
npm run dev                  # http://localhost:3000
npm run test:matching        # 15 unit tests on the matching engine
```

Preview on Cloudflare Workers locally:
```bash
npm run preview              # runs opennextjs-cloudflare build && preview
```

## Project map

```
app/                  landing, login/signup, auth callback, dashboard/*, admin/*
components/           AuthForm, ProjectForm, ProfileForm, OfferForm, MatchBadge, Wordmark
lib/                  supabase clients (browser/server), server actions, formatters
services/matching.ts  weighted engine — calculateMatchScore / tierOf / rankOpportunities
types/                all TypeScript interfaces
tests/                matching engine unit tests (15)
supabase/schema.sql   one-shot database: tables, indexes, RLS, triggers, buckets, seed
middleware.ts         session refresh + route protection
wrangler.jsonc        Cloudflare Workers config
open-next.config.ts   OpenNext adapter config for Cloudflare
```

## Matching engine (services/matching.ts)

Weights: Genre 20 · Stage 20 · Country 15 · Budget 15 · Format 10 · Funding 10 · Language 5 · Historical 5.
Tiers: 90–100 Excellent · 75–89 Strong · 60–74 Possible · <60 Hidden.
Returns `{ score, confidence, reasons, strengths, warnings }` with partial credit (adjacent stages, near-miss budgets), region awareness (Global South funds), hard eligibility gates, and deadline urgency warnings. Scores are pre-computed into the `matches` table on project creation and re-ranked live on project pages.

## AI features — architecture is ready

`services/` is the seam: drop in `services/ai/scriptAnalysis.ts`, `pitchDeckAnalysis.ts`, `fundingAdvisor.ts` calling the Anthropic API; store results in a new `ai_analyses` table (same RLS pattern); surface on the project detail page. The matching engine's `historicalSuccessRate` input is already wired for learned signals.

— Built for Nobin Kurian · FYLYMPITCH · a FYLYM company · Ernakulam, Kerala
