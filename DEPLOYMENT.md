# FYLYMPITCH — Go-Live Guide (≈20 minutes)

Stack: Next.js 16 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) · Cloudflare Workers

---

## STEP 1 — Supabase (≈8 min)

1. Go to https://supabase.com/dashboard → **New project** → name it `fylympitch`, choose a strong DB password, region **Mumbai (ap-south-1)** (closest to Kerala users).
2. When the project is ready, open **SQL Editor** → **New query** → paste the ENTIRE contents of `supabase/schema.sql` → **Run**.
   - This creates all 11 tables, every index, all Row Level Security policies, the two private storage buckets (`pitch-decks`, `scripts`), triggers, and seeds 10 real opportunities (Hubert Bals, NFDC Film Bazaar, Sundance, Eurimages, Berlinale WCF, Busan ACF, Doha, Rotterdam Lab, Cannes Producers Network, Visions Sud Est).
3. Run migrations in order (SQL Editor → New query for each):
   ```
   supabase/migrations/002_certificates_and_reports.sql
   supabase/migrations/003_fylympitch_engine.sql
   supabase/migrations/004_opportunity_metadata.sql
   supabase/migrations/005_master_data_seed.sql
   supabase/migrations/006_projects_showcase_visibility.sql
   supabase/migrations/007_project_thumbnails.sql
   supabase/migrations/008_onboarding.sql
   supabase/migrations/009_producer_studio.sql
   supabase/migrations/010_messaging.sql
   supabase/migrations/011_ai_engine_columns.sql
   supabase/migrations/012_profile_email.sql
   supabase/migrations/013_fix_email_rls.sql
   supabase/migrations/014_fix_project_rls_and_showcase.sql
   supabase/migrations/015_remove_onboarding_gate.sql
   supabase/migrations/016_dual_roles.sql
   ```
4. **Make yourself admin**: sign up once on your deployed site (Step 3), then in SQL Editor run:
   ```sql
   update public.profiles set role = 'admin', approval_status = 'approved'
   where id = (select id from auth.users where email = 'nobinkurian@yahoo.com');
   ```
5. Copy your keys: **Project Settings → API** →
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Never expose the `service_role` key — it is not used by this app.)

### Google Login (required)
1. https://console.cloud.google.com → Credentials → **Create OAuth Client ID** (Web application).
2. Authorised JavaScript origins: `https://pitch.fylym.com`
3. Authorised redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
4. In Supabase: **Authentication → Providers → Google** → paste Client ID + Secret → Enable.

### Auth URLs (required)
**Authentication → URL Configuration**:
- Site URL: `https://pitch.fylym.com`
- Redirect URLs:
  - `https://pitch.fylym.com/auth/callback`
  - `https://fylympitch.nobinkurian.workers.dev/auth/callback`
  - `http://localhost:3000/auth/callback`

> **No database changes are needed when switching deployment platforms.** The schema, RLS policies, triggers and storage buckets are entirely platform-agnostic. Only the Auth URL configuration above needs to reflect your live domain.

---

## STEP 2 — Cloudflare Workers (≈7 min)

This app uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) to run Next.js 16 on Cloudflare Workers. The `wrangler.jsonc` and `open-next.config.ts` files are already configured.

### Option A — Cloudflare Dashboard (recommended)
1. Push this repo to GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `.open-next/assets`
4. **Settings → Environment variables**, add ALL of the following as **Secrets**:

| Key | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Step 1.5 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 1.5 | ✅ |
| `NEXT_PUBLIC_SITE_URL` | `https://pitch.fylym.com` | ✅ |
| `RESEND_API_KEY` | from resend.com | ✅ |
| `CEREBERAS_API` | from cloud.cerebras.ai | ⚡ AI engine |
| `GROQ_API_KEY` | from console.groq.com | ⚡ AI engine |
| `OPENAI_API_KEY` | from platform.openai.com | ⚡ AI + web search |

> `NEXT_PUBLIC_SITE_URL` is used by transactional emails (offer notifications, producer approvals). Without it, email links default to `https://fylympitch.com`.

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
wrangler secret put CEREBERAS_API
wrangler secret put GROQ_API_KEY
wrangler secret put OPENAI_API_KEY
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
5. **Sign up** a second account as Producer → land on dashboard (dual roles, no approval gate).
6. As **admin** (`/admin`): Users → verify a user → producer can now open **Discover**, read the script via signed link, and **Make an offer**.
7. Back as the filmmaker: the offer appears on the dashboard → **Accept** → producer gets a notification.
8. `/admin` analytics counters all moved. Audit log shows the approval.

If all eight pass, you are live.

---

## Security model

- **RLS on every table** (40+ policies): users can only read/write their own rows; approved industry users only see public projects — enforced in Postgres, not the browser.
- **Admin checks are server-side**: `/admin` layout verifies `role = 'admin'` from the database on every request; all admin actions re-verify via `requireAdmin()` in server actions.
- **No localStorage gating** anywhere. Sessions are httpOnly cookies via `@supabase/ssr`.
- **Files are private**: pitch decks and scripts live in private buckets; access is via 1-hour signed URLs, granted only to the owner, approved industry users, and admins.
- **Email is protected**: `profiles.email` column is revoked from `authenticated` role; only accessible via `profile_email(uuid)` SECURITY DEFINER function (Migration 013).
- Users **cannot self-promote** their role (column protected by RLS policy + trigger).

---

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase keys + AI keys
npm install
npm run dev                  # http://localhost:3000
npm run test:matching        # unit tests on the matching engine
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
services/fylympitchEngine.ts  hybrid AI + heuristic engine, producer matching
services/aiEngine.ts  Cerebras / Groq / OpenAI provider abstraction
types/                all TypeScript interfaces
tests/                matching engine unit tests
supabase/schema.sql   one-shot database: tables, indexes, RLS, triggers, buckets, seed
supabase/migrations/  incremental migrations 002–016 (run after schema.sql)
middleware.ts         session refresh + route protection
wrangler.jsonc        Cloudflare Workers config
open-next.config.ts   OpenNext adapter config for Cloudflare
```

## Matching engine (services/matching.ts)

Weights: Genre 20 · Stage 20 · Country 15 · Budget 15 · Format 10 · Funding 10 · Language 5 · Historical 5.
Tiers: 90–100 Excellent · 75–89 Strong · 60–74 Possible · <60 Hidden.
Returns `{ score, confidence, reasons, strengths, warnings }` with partial credit (adjacent stages, near-miss budgets), region awareness (Global South funds), hard eligibility gates, and deadline urgency warnings. Scores are pre-computed into the `matches` table on project creation and re-ranked live on project pages.

## AI Engine (services/aiEngine.ts)

Provider priority: **Cerebras** (primary, ultra-fast) → **Groq** (secondary, ~400 tok/s) → **OpenAI** (fallback + web search EP brief).
Set `OPENAI_WEB_SEARCH=true` in env to enable live fund deadline verification in the Executive Producer brief (requires `OPENAI_API_KEY`).

— Built for Nobin Kurian · FYLYMPITCH · a FYLYM company · Ernakulam, Kerala
