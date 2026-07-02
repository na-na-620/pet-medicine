-- ===================================================
-- 薬の投薬終了日（end_date）列追加
-- Supabase Dashboard > SQL Editor で実行してください
-- ===================================================

-- medicines テーブルに end_date 列を追加
-- 投薬中OFFの場合にいつまで投薬予定を表示するかを指定。
-- NULLの場合はis_activeの値のみで制御。
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS end_date DATE;
