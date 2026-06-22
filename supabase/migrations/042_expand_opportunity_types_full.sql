-- ============================================================
-- FYLYMPITCH — Migration 042: Full opportunity_type taxonomy
-- Run in Supabase SQL Editor.
-- Adds 30 new enum values covering the complete 9-category
-- taxonomy for Film Opportunities.
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Run as individual statements or as a single script outside
-- any BEGIN/COMMIT block.
-- ============================================================

-- ── Development ─────────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'residency';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'mentorship';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'writing_fellowship';

-- ── Packaging & Markets ─────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'pitch_forum';

-- ── Early Financing ─────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'donation';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'fiscal_sponsorship';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'seed_funding';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'community_funding';

-- ── Tax Incentives ──────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'cash_rebate';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'production_rebate';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'regional_incentive';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'location_incentive';

-- ── Private Financing ───────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'angel_investor';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'venture_capital';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'gap_financing';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'product_placement';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'private_fund';

-- ── Production ──────────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'co_producer';

-- ── Post Production ─────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'post_production_grant';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'post_production_fund';

-- ── Buyers & Sales ──────────────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'world_sales';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'content_buyer';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'music_rights';

-- ── Release & Distribution ──────────────────────────────────
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'film_festival';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'theatrical_distribution';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'ott_distribution';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'tv_distribution';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'digital_aggregator';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'educational_distribution';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'airline_distribution';
