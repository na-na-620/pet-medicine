-- ===================================================
-- ペット投薬管理アプリ Supabase テーブル定義
-- Supabase Dashboard の SQL Editor で実行してください
-- ===================================================

-- ペットテーブル（上限30頭はアプリ側で制御）
create table if not exists pets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  birthday    date,
  weight      numeric(5,2),
  icon_type   text default 'emoji',   -- 'emoji' or 'photo'
  icon_value  text default '🐕',      -- 絵文字文字 or Storageの公開URL
  created_at  timestamptz default now()
);

-- 薬テーブル（上限20種/ペットはアプリ側で制御）
create table if not exists medicines (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid references pets on delete cascade not null,
  user_id         uuid references auth.users not null,
  icon            text default '💊',
  name            text not null,
  efficacy        text default '',    -- 効能・メモ
  timings         text[] default '{}',-- 投薬タイミング配列 例: ['朝','晩']
  time_settings   jsonb default '{}', -- タイミングごとの時間設定
                                      -- 例: {"朝":{"type":"range","start":"08:00","end":"09:00"}}
  dose_amount     text default '1錠', -- 投薬量 例: '1錠','半錠','全量','1/3','2/3'
  interval_hours  numeric(4,1) default 8, -- 次回投薬まで空ける時間（時間単位）
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- 投薬記録テーブル
create table if not exists medication_logs (
  id                  uuid primary key default gen_random_uuid(),
  medicine_id         uuid references medicines on delete cascade not null,
  pet_id              uuid references pets on delete cascade not null,
  user_id             uuid references auth.users not null,
  log_date            date not null,
  timing              text not null,    -- 投薬タイミング（朝/昼/晩など）
  administered_percent integer default 0 check (administered_percent between 0 and 100),
  note                text default '',  -- 薬ごとの備考
  shared_note         text default '',  -- 投薬状況の共有メモ
  administered_at     timestamptz,
  created_at          timestamptz default now(),
  -- 同じ薬・同じ日・同じタイミングは1レコード（upsert用）
  unique (medicine_id, log_date, timing)
);

-- ===================================================
-- Row Level Security（自分のデータのみ操作可能）
-- ===================================================
alter table pets enable row level security;
alter table medicines enable row level security;
alter table medication_logs enable row level security;

create policy "自分のペットのみ" on pets
  for all using (auth.uid() = user_id);

create policy "自分の薬のみ" on medicines
  for all using (auth.uid() = user_id);

create policy "自分の投薬記録のみ" on medication_logs
  for all using (auth.uid() = user_id);

-- ===================================================
-- Storage バケット（ペットアイコン写真用）
-- Supabase Dashboard > Storage で "pet-icons" バケットを
-- Public で作成してください（SQLでは作成できません）
-- ===================================================
