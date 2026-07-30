-- Migration 065: Raise avatars bucket file size limit from 2 MB to 10 MB
-- Client-side check in components/AvatarUpload.tsx also updated to 10 * 1024 * 1024.
update storage.buckets
set file_size_limit = 10485760 -- 10 MB
where id = 'avatars';
