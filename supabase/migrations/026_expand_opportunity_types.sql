-- ============================================================
-- FYLYMPITCH — Migration 026: Expand opportunity_type enum
-- Run in Supabase SQL Editor.
-- Adds 8 new fund/partner types to the opportunity_type enum.
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- ============================================================

ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'producer';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'brand_integration';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'crowdfunding';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'production_company';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'studio';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'sponsor';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'pre_sale';
ALTER TYPE opportunity_type ADD VALUE IF NOT EXISTS 'tax_incentive';
