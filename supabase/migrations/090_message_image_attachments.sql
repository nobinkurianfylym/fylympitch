-- ============================================================================
-- FYLYMPITCH - Migration 090: allow images as message attachments
--
-- A producer replying to an exclusive pitch could not attach a JPEG. Nobody
-- could -- the restriction was on every conversation, not that one.
--
-- Three layers each allowed only pdf / docx / xlsx / zip, and each would have
-- refused an image on its own:
--
--   1. the composer        features/messages/message.types.ts   (app code)
--   2. the table           chk_attachment_extension on messages (this file)
--   3. the storage bucket  allowed_mime_types on message-attachments (this file)
--
-- Widening only the first would have moved the failure: the upload would be
-- refused by the bucket, or the row by the constraint, with a less helpful
-- error than the composer gives. All three change together.
--
-- JPG, JPEG, PNG and WebP. NOT SVG: it is an image format that can carry
-- script, and these files are opened by the other person in the conversation.
-- ============================================================================

-- ---------- 1. The table ----------
-- Every existing row is pdf/docx/xlsx/zip, a subset of the new list, so the
-- re-added constraint validates without touching data.
alter table public.messages
  drop constraint if exists chk_attachment_extension;

alter table public.messages
  add constraint chk_attachment_extension check (
    attachment_extension is null or
    lower(attachment_extension) in ('pdf', 'docx', 'xlsx', 'zip', 'jpg', 'jpeg', 'png', 'webp')
  );


-- ---------- 2. The bucket ----------
-- Size limit unchanged at 50 MB. Still private: images are served through
-- short-lived signed URLs, the same as every other attachment, so a photo
-- sent in a conversation is only visible to its two participants.
update storage.buckets
set    allowed_mime_types = array[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/zip',
         'application/x-zip-compressed',
         'image/jpeg',
         'image/png',
         'image/webp'
       ]
where  id = 'message-attachments';


-- ---------- Check ----------
select 'constraint' as layer,
       case when pg_get_constraintdef(c.oid) ilike '%jpeg%' then 'images allowed' else 'STILL BLOCKED' end as status
from   pg_constraint c
where  c.conname = 'chk_attachment_extension'

union all

select 'bucket',
       case when 'image/jpeg' = any(allowed_mime_types) then 'images allowed' else 'STILL BLOCKED' end
from   storage.buckets
where  id = 'message-attachments'

union all

select 'bucket is private',
       case when public then 'PUBLIC - WRONG' else 'yes' end
from   storage.buckets
where  id = 'message-attachments';

-- Expected: constraint images allowed / bucket images allowed / private yes.
