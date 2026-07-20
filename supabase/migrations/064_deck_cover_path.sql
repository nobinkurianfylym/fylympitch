-- Migration 064: static deck cover thumbnails
--
-- Public project surfaces currently render the deck cover by downloading pdf.js
-- + the full PDF and rasterising page 1 in the browser on every view — slow and
-- heavy (bad LCP). Instead we render the cover ONCE (at upload, client-side) and
-- store its path here, then serve a plain image. Existing decks are backfilled
-- by the owner's browser when they next view their project.
--
-- The cover image lives in the existing public `thumbnails` bucket under
-- `deck-covers/…`, so no new bucket or storage policy is required.

alter table public.projects add column if not exists deck_cover_path text;

comment on column public.projects.deck_cover_path is
  'Storage path (in the public thumbnails bucket) of a pre-rendered page-1 cover image for the pitch deck. Lets public pages avoid client-side pdf.js.';
