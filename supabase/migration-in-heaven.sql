-- ===================================================
-- お空の子（旅立ったペット）ステータス追加
-- Supabase Dashboard > SQL Editor で実行してください
-- ===================================================

-- pets テーブルに in_heaven 列を追加
-- デフォルト false（通常のペット）
ALTER TABLE pets ADD COLUMN IF NOT EXISTS in_heaven BOOLEAN DEFAULT FALSE;
