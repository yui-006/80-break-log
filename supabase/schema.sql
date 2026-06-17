-- 80 Break Log — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id                uuid primary key references auth.users on delete cascade,
  goal_threshold    int  not null default 95,
  active_club_set_id text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── courses (CourseHole[] stored as JSONB) ────────────────────────────────────
create table if not exists courses (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  location    text,
  prefecture  text,
  source      text,
  source_id   text,
  source_url  text,
  memo        text,
  holes       jsonb not null default '[]',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── rounds (RoundHole[] including Shot[] stored as JSONB) ────────────────────
create table if not exists rounds (
  id            uuid primary key,
  user_id       uuid not null references auth.users on delete cascade,
  course_id     text,
  course_name   text,
  date          date not null,
  tee_name      text,
  target_score  int,
  weather       text,
  memo          text,
  status        text not null default 'recording',
  holes         jsonb not null default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── club_sets (Club[] stored as JSONB) ───────────────────────────────────────
create table if not exists club_sets (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  clubs       jsonb not null default '[]',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── practice_logs ─────────────────────────────────────────────────────────────
create table if not exists practice_logs (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  menu_name   text,
  ball_count  int,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── RLS: enable on all tables ─────────────────────────────────────────────────
alter table profiles     enable row level security;
alter table courses      enable row level security;
alter table rounds       enable row level security;
alter table club_sets    enable row level security;
alter table practice_logs enable row level security;

-- ── RLS policies ─────────────────────────────────────────────────────────────
create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own courses" on courses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rounds" on rounds for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own club_sets" on club_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own practice_logs" on practice_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── updated_at auto-update trigger ───────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function touch_updated_at();
create trigger set_updated_at before update on courses
  for each row execute function touch_updated_at();
create trigger set_updated_at before update on rounds
  for each row execute function touch_updated_at();
create trigger set_updated_at before update on club_sets
  for each row execute function touch_updated_at();
create trigger set_updated_at before update on practice_logs
  for each row execute function touch_updated_at();
