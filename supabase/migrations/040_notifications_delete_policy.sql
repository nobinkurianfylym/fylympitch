-- ============================================================
-- Migration 040: Allow users to delete their own notifications
-- The notifications table was created with SELECT + UPDATE policies
-- only. DELETE was missing, causing the server action to silently
-- no-op (RLS blocks without error).
-- Run once in Supabase SQL Editor.
-- ============================================================

-- Single notification delete (used by the × button per row)
create policy "delete own notification"
  on public.notifications
  for delete
  using (user_id = auth.uid());
