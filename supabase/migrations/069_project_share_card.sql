-- ============================================================================
-- FYLYMPITCH — Migration 069: share_card_path on projects
-- Run once in the Supabase SQL Editor.
--
-- A social card slot is roughly 1.91:1; a film poster is 2:3. Posting a bare
-- poster gets it centre-cropped, and what gets cut is the title treatment at
-- the top and the credit block at the bottom — the two parts that carry the
-- film's identity. share_card_path holds a purpose-built 1200x630 composition
-- (poster contained, title and logline beside it) so nothing is cropped.
--
-- The app writes this column in its own UPDATE, separate from the project
-- INSERT, so deploying the code before running this migration degrades to "no
-- share card" rather than breaking project creation. Run it whenever.
-- ============================================================================

alter table public.projects
  add column if not exists share_card_path text;

comment on column public.projects.share_card_path is
  'Storage path in the public thumbnails bucket for the 1200x630 social share card. Composed client-side at save time (lib/share-card.ts); null falls back to poster_path, then deck_cover_path.';

-- Existing projects backfill themselves: ShareCardBackfill composes the card
-- the next time the owner opens the project, the same passive pattern as deck
-- covers. Nothing to do here.

-- ── Check ──────────────────────────────────────────────────────────────────
select count(*)                                        as projects,
       count(*) filter (where share_card_path is not null) as with_share_card,
       count(*) filter (where poster_path     is not null) as with_poster,
       count(*) filter (where deck_cover_path is not null) as with_deck_cover
from   public.projects
where  is_public;
