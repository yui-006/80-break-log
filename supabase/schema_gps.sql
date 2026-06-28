-- GPS: green_points table
-- Run this in the Supabase SQL Editor after schema.sql

create table if not exists green_points (
  id          uuid primary key,
  course_id   uuid not null references courses(id) on delete cascade,
  hole_number int  not null,
  lat         double precision not null,
  lng         double precision not null,
  point_type  text not null default 'center', -- 'center' | 'front' | 'back' | 'tee'
  green_label text not null default 'main',   -- 'main' | 'A' | 'B' (for 2-green holes)
  updated_at  timestamptz default now(),
  unique (course_id, hole_number, green_label, point_type)
);

-- Migration: add green_label to existing tables
alter table green_points add column if not exists green_label text not null default 'main';
-- Drop old constraint (single point_type per hole) and replace with label-aware one
alter table green_points drop constraint if exists green_points_course_id_hole_number_point_type_key;
alter table green_points add constraint green_points_course_hole_label_type_key
  unique (course_id, hole_number, green_label, point_type);

-- RLS: ownership via courses table (no user_id column on green_points itself)
alter table green_points enable row level security;

create policy "Users manage own green points" on green_points
  using (
    exists (
      select 1 from courses
      where courses.id = green_points.course_id
        and courses.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from courses
      where courses.id = green_points.course_id
        and courses.user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create trigger touch_green_points_updated_at
  before update on green_points
  for each row execute function touch_updated_at();
