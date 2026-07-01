-- ===================================================
-- Supabase Storage アップロードポリシー設定
-- 写真アップロード機能を使う前にこのSQLを実行してください
-- Supabase Dashboard > SQL Editor で実行
-- ===================================================

-- 認証済みユーザーが pet-icons バケットにアップロード可能
insert into storage.policies (name, bucket_id, operation, definition)
values
  ('authenticated users can upload',  'pet-icons', 'INSERT',
   '(auth.role() = ''authenticated'')'),
  ('authenticated users can update',  'pet-icons', 'UPDATE',
   '(auth.role() = ''authenticated'')'),
  ('public can view pet icons',       'pet-icons', 'SELECT',
   'true');

-- ※ 上記が失敗する場合は Supabase Dashboard > Storage > pet-icons バケット
--    > Policies タブから手動で以下のポリシーを追加してください：
--
--    INSERT（アップロード）: auth.role() = 'authenticated'
--    UPDATE（上書き）      : auth.role() = 'authenticated'
--    SELECT（表示）        : true（全員）
