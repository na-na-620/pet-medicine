-- ===================================================
-- 旅立った日（death_date）列追加
-- Supabase Dashboard > SQL Editor で実行してください
-- ===================================================

-- pets テーブルに death_date 列を追加
-- お空の子の旅立った日付。この日以前のトップ画面には投薬予定が残る。
ALTER TABLE pets ADD COLUMN IF NOT EXISTS death_date DATE;
