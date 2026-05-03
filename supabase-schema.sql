-- ============================================
-- Titan Fitness — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Equipment
create table equipment (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('weights', 'cardio', 'recovery', 'other')),
  description text not null default '',
  icon text not null default '',
  enabled boolean not null default false,
  primary key (user_id, id)
);

alter table equipment enable row level security;
create policy "Users manage own equipment" on equipment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Workout Plans
create table workout_plans (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  style text not null,
  exercises jsonb not null default '[]',
  duration_min integer not null default 0,
  estimated_calories integer not null default 0,
  focus text not null default '',
  equipment_used jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  intensity smallint not null default 2,
  primary key (user_id, id)
);

alter table workout_plans enable row level security;
create policy "Users manage own workout plans" on workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Workout Sessions
create table sessions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text,
  name text not null,
  style text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer not null default 0,
  exercises jsonb not null default '[]',
  total_volume numeric not null default 0,
  total_sets integer not null default 0,
  personal_records integer not null default 0,
  notes text,
  primary key (user_id, id)
);

alter table sessions enable row level security;
create policy "Users manage own sessions" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index sessions_started_at on sessions (user_id, started_at desc);

-- 4. Personal Records
create table personal_records (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  weight numeric not null default 0,
  reps integer not null default 0,
  date text not null,
  primary key (user_id, id)
);

alter table personal_records enable row level security;
create policy "Users manage own PRs" on personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index personal_records_exercise on personal_records (user_id, exercise_name);

-- 5. Profile
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  injuries text,
  additional_equipment text,
  weight numeric,
  height numeric,
  gender text check (gender in ('male', 'female', 'other')),
  rest_timer_sound boolean default true,
  workout_mode text default 'daily' check (workout_mode in ('daily', 'program')),
  avg_workout_minutes integer,
  program_active_days integer default 6,
  count_in boolean default false,
  count_in_seconds smallint default 3 check (count_in_seconds in (3, 5, 7)),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, name, created_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'), now());
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Chat Messages
create table chat_messages (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  timestamp timestamptz not null default now(),
  rich_content jsonb,
  primary key (user_id, id)
);

alter table chat_messages enable row level security;
create policy "Users manage own chat" on chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index chat_messages_time on chat_messages (user_id, timestamp);

-- 7. Nutrition Logs (Meal Logs)
create table nutrition_logs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  entries jsonb not null default '[]',
  timestamp bigint not null default 0,
  primary key (user_id, id)
);

alter table nutrition_logs enable row level security;
create policy "Users manage own nutrition logs" on nutrition_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index nutrition_logs_date on nutrition_logs (user_id, date);

-- 8. Foods (cache)
create table foods (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fats numeric not null default 0,
  serving_size numeric not null default 0,
  serving_unit text not null default '',
  barcode text,
  source text not null default 'manual' check (source in ('scan', 'ai', 'manual')),
  primary key (user_id, id)
);

alter table foods enable row level security;
create policy "Users manage own foods" on foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index foods_barcode on foods (user_id, barcode) where barcode is not null;

-- 9. Nutrition Goals
create table nutrition_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  calories numeric not null default 2000,
  protein numeric not null default 150,
  carbs numeric not null default 200,
  fats numeric not null default 65,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  primary key (user_id, date)
);

alter table nutrition_goals enable row level security;
create policy "Users manage own nutrition goals" on nutrition_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10. Starred Foods
create table starred_foods (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fats numeric not null default 0,
  serving_size numeric not null default 0,
  serving_unit text not null default '',
  barcode text,
  source text not null default 'manual' check (source in ('scan', 'ai', 'manual')),
  starred_at bigint not null default 0,
  primary key (user_id, id)
);

alter table starred_foods enable row level security;
create policy "Users manage own starred foods" on starred_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 11. Weight History
create table weight_history (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  weight numeric not null,
  timestamp timestamptz not null default now(),
  primary key (user_id, id)
);

alter table weight_history enable row level security;
create policy "Users manage own weight history" on weight_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weight_history_date on weight_history (user_id, date desc);

-- 12. Workout Programs
create table programs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  days jsonb not null default '[]',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  equipment jsonb not null default '[]',
  primary key (user_id, id)
);

alter table programs enable row level security;
create policy "Users manage own programs" on programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
