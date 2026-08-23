-- ===================================================================
-- Mindraft · 0008 private storage bucket for attachments
-- Path convention: {workspace_id}/{entity_type}/{uuid}-{filename}
-- The first path segment is the authorisation key.
-- Guarded so the migration set can also be applied to a plain Postgres
-- instance (used by the SQL test-suite in scripts/).
-- ===================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'attachments',
    'attachments',
    false,
    26214400, -- 25 MB
    array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
  on conflict (id) do update
    set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types,
        public = false;

  execute 'drop policy if exists attachments_read on storage.objects';
  execute $pol$
    create policy attachments_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'attachments'
        and app.is_member(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_insert on storage.objects';
  execute $pol$
    create policy attachments_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_update on storage.objects';
  execute $pol$
    create policy attachments_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;

  execute 'drop policy if exists attachments_delete on storage.objects';
  execute $pol$
    create policy attachments_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'attachments'
        and app.can_write(((storage.foldername(name))[1])::uuid)
      )
  $pol$;
end $$;
