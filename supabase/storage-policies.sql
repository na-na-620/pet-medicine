-- ===================================================
-- Supabase Storage アップロードポリシー設定
-- 写真アップロード機能を使う前にこのSQLを実行してください
-- Supabase Dashboard > SQL Editor で実行
-- ===================================================

-- 認証済みユーザーが pet-icons バケットにアップロード可能
create policy "authenticated users can upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'pet-icons');

-- 認証済みユーザーが既存ファイルを上書き可能
create policy "authenticated users can update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'pet-icons');

-- 全員が pet-icons バケットのファイルを閲覧可能
create policy "public can view pet icons"
  on storage.objects
  for select
  to public
  using (bucket_id = 'pet-icons');
