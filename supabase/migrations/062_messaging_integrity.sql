-- Migration 062: Messaging integrity fixes
--
-- ── 1. Message tampering ─────────────────────────────────────────────────────
--
-- Migration 033 created this policy under the comment
--   "Only allow updating read_at and soft-delete fields (no message editing)"
-- but the policy does not do that:
--
--   create policy "participant updates message timestamps"
--     on public.messages for update
--     using ( <caller is a participant in the conversation> );
--
-- RLS cannot restrict UPDATE to specific columns, and there is no WITH CHECK.
-- So the policy says only "you are in this conversation" — after which either
-- participant can rewrite ANY column of ANY message in it, including the
-- counterparty's. Concretely, today a participant can:
--   * edit the text of a message the other person sent, after the fact;
--   * reassign sender_id, making their own message appear to come from them;
--   * clear deleted_at to resurrect a removed message;
--   * forge read_at, or set sent_at into the future.
--
-- On a platform whose whole premise is a verifiable record between filmmakers
-- and producers, a silently editable message log is the wrong default.
-- Column-level immutability has to be enforced by a trigger.

CREATE OR REPLACE FUNCTION public.enforce_message_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Content and provenance are write-once.
  IF NEW.message              IS DISTINCT FROM OLD.message
     OR NEW.sender_id         IS DISTINCT FROM OLD.sender_id
     OR NEW.conversation_id   IS DISTINCT FROM OLD.conversation_id
     OR NEW.sent_at           IS DISTINCT FROM OLD.sent_at
     OR NEW.created_at        IS DISTINCT FROM OLD.created_at
     OR NEW.created_by        IS DISTINCT FROM OLD.created_by
     OR NEW.attachment_name   IS DISTINCT FROM OLD.attachment_name
     OR NEW.attachment_size   IS DISTINCT FROM OLD.attachment_size
     OR NEW.attachment_mime   IS DISTINCT FROM OLD.attachment_mime
     OR NEW.attachment_extension IS DISTINCT FROM OLD.attachment_extension
     OR NEW.storage_bucket    IS DISTINCT FROM OLD.storage_bucket
     OR NEW.storage_path      IS DISTINCT FROM OLD.storage_path
  THEN
    RAISE EXCEPTION 'message_immutable'
      USING HINT = 'Message content cannot be edited once sent.';
  END IF;

  -- read_at / delivered_at are monotonic: they may be set once, never cleared
  -- and never rewritten. Otherwise a reader could un-read a message, or a
  -- sender could forge a receipt.
  IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
    RAISE EXCEPTION 'read_receipt_immutable'
      USING HINT = 'A read receipt cannot be changed once recorded.';
  END IF;
  IF OLD.delivered_at IS NOT NULL AND NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'delivery_receipt_immutable'
      USING HINT = 'A delivery receipt cannot be changed once recorded.';
  END IF;

  -- Soft delete is one-way, and only the sender may delete their own message.
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'undelete_forbidden'
      USING HINT = 'A removed message cannot be restored.';
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth.uid() IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'delete_forbidden'
        USING HINT = 'Only the sender may remove their own message.';
    END IF;
    IF NEW.deleted_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'delete_attribution_invalid'
        USING HINT = 'deleted_by must be the acting user.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_message_immutability() IS
  'Enforces what the messages UPDATE policy only claims: after insert, the only
   mutable fields are delivered_at, read_at and a one-way soft delete by the
   sender. RLS cannot express column-level rules, so this trigger carries them.';

-- SECURITY INVOKER by design: it must see the real auth.uid() of the caller.
DROP TRIGGER IF EXISTS trg_enforce_message_immutability ON public.messages;
CREATE TRIGGER trg_enforce_message_immutability
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_immutability();

-- mark_conversation_read() is SECURITY DEFINER and runs as the function owner,
-- so auth.uid() inside the trigger still resolves to the calling user via the
-- request JWT. It only ever sets read_at on rows where read_at IS NULL, which
-- the rules above permit.


-- ── 2. Attachment storage policies: non-uuid paths raise ─────────────────────
--
-- Migration 033's storage policies cast the first path segment to uuid:
--   c.id = (storage.foldername(name))[1]::uuid
-- Postgres does not guarantee AND short-circuits before the cast, so an object
-- in another bucket whose first folder is not a uuid can make the cast raise
-- rather than simply not match. Guard the cast with a regex test first.

DROP POLICY IF EXISTS "participant uploads message attachment" ON storage.objects;
CREATE POLICY "participant uploads message attachment"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = ((storage.foldername(name))[1])::uuid
        AND (c.producer_id = auth.uid() OR c.filmmaker_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participant reads message attachment" ON storage.objects;
CREATE POLICY "participant reads message attachment"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = ((storage.foldername(name))[1])::uuid
        AND (c.producer_id = auth.uid() OR c.filmmaker_id = auth.uid())
    )
  );


-- ── 3. Verification (run manually after applying) ────────────────────────────
--
-- -- As a participant, editing the counterparty's message must now fail:
-- UPDATE public.messages SET message = 'tampered' WHERE id = '<their-message-id>';
-- -- Expected: ERROR message_immutable
--
-- -- Marking read must still work:
-- SELECT public.mark_conversation_read('<conversation-id>');
-- -- Expected: success, read_at populated on counterparty messages.
--
-- -- Re-running it must not raise (read_at already set is skipped by the RPC's
-- -- `read_at is null` predicate, so the monotonic rule is never hit):
-- SELECT public.mark_conversation_read('<conversation-id>');
-- -- Expected: success.
--
-- -- Confirm the immutability trigger is attached:
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal;
-- -- Expected to include trg_enforce_message_immutability.
