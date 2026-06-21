-- ============================================================
-- FYLYMPITCH — Migration 038: budget_currency
-- Adds budget_currency to projects so budget fields can be
-- entered in any currency and displayed correctly.
-- USD equivalents remain stored in *_usd columns for matching.
-- Run once in Supabase SQL Editor.
-- ============================================================

alter table public.projects
  add column if not exists budget_currency text not null default 'USD'
    check (budget_currency in ('USD','EUR','GBP','CAD','AUD','INR','NGN','ZAR','BRL','NOK','CHF','KRW'));

comment on column public.projects.budget_currency is
  'Currency the filmmaker used for budget entry. *_usd columns store USD equivalents for matching.';
