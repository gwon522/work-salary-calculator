create table if not exists public.organization_divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  head_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_teams (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.organization_divisions(id) on delete cascade,
  name text not null,
  head_user_id uuid,
  created_at timestamptz not null default now(),
  unique (division_id, name)
);

create table if not exists public.organization_parts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.organization_teams(id) on delete cascade,
  name text not null,
  head_user_id uuid,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null default 'user',
  position text not null default '사원',
  hire_date date,
  organization_division_id uuid references public.organization_divisions(id) on delete set null,
  organization_team_id uuid references public.organization_teams(id) on delete set null,
  organization_part_id uuid references public.organization_parts(id) on delete set null,
  annual_salary numeric not null default 0,
  standard_hourly_wage numeric default 0,
  dependent_count integer not null default 1,
  child_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id integer primary key default 1 check (id = 1),
  default_regular_minutes integer not null default 540,
  default_regular_start_time time not null default '10:00',
  default_regular_end_time time not null default '19:00',
  default_break_minutes integer not null default 60,
  monthly_non_taxable_pay numeric not null default 0,
  weekly_holiday_day integer not null default 0,
  saturday_policy text not null default 'offday',
  monthly_inclusive_overtime_hours numeric not null default 52.14,
  monthly_inclusive_holiday_hours numeric not null default 13.333333,
  pension_rate numeric not null default 4.75,
  health_insurance_rate numeric not null default 3.595,
  long_term_care_rate numeric not null default 13.14,
  employment_insurance_rate numeric not null default 0.9,
  local_income_tax_rate numeric not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  is_substitute boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'login_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    alter table public.profiles rename column login_id to email;
  end if;
end $$;

alter table public.profiles
add column if not exists annual_salary numeric not null default 0;

alter table public.profiles
add column if not exists standard_hourly_wage numeric default 0;

alter table public.profiles
add column if not exists role text not null default 'user';

alter table public.profiles
add column if not exists position text not null default '사원';

alter table public.profiles
add column if not exists hire_date date;

alter table public.profiles
add column if not exists organization_division_id uuid references public.organization_divisions(id) on delete set null;

alter table public.profiles
add column if not exists organization_team_id uuid references public.organization_teams(id) on delete set null;

alter table public.profiles
add column if not exists organization_part_id uuid references public.organization_parts(id) on delete set null;

alter table public.profiles
add column if not exists dependent_count integer not null default 1;

alter table public.profiles
add column if not exists child_count integer not null default 0;

alter table public.organization_divisions
add column if not exists head_user_id uuid references public.profiles(id) on delete set null;

alter table public.organization_teams
add column if not exists head_user_id uuid references public.profiles(id) on delete set null;

alter table public.organization_parts
add column if not exists head_user_id uuid references public.profiles(id) on delete set null;

insert into public.system_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  hourly_wage numeric not null,

  office_clock_in timestamptz not null,
  office_clock_out timestamptz not null,
  remote_clock_in timestamptz,
  remote_clock_out timestamptz,

  commute_minutes integer not null default 0,
  break_minutes integer not null default 0,
  is_holiday boolean not null default false,

  regular_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  night_minutes integer not null default 0,
  holiday_minutes integer not null default 0,
  leave_type text not null default 'none',
  leave_minutes integer not null default 0,
  overtime_reason text,

  regular_pay numeric not null default 0,
  overtime_pay numeric not null default 0,
  night_pay numeric not null default 0,
  holiday_pay numeric not null default 0,
  leave_pay numeric not null default 0,
  total_pay numeric not null default 0,

  created_at timestamptz not null default now()
);

alter table public.work_logs
add column if not exists leave_type text not null default 'none';

alter table public.work_logs
add column if not exists leave_minutes integer not null default 0;

alter table public.work_logs
add column if not exists leave_pay numeric not null default 0;

alter table public.work_logs
add column if not exists overtime_reason text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    role,
    position,
    hire_date,
    organization_division_id,
    organization_team_id,
    organization_part_id,
    annual_salary,
    standard_hourly_wage,
    dependent_count,
    child_count
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'user',
    '사원',
    null,
    null,
    null,
    null,
    0,
    0,
    1,
    0
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    role = coalesce(
      public.profiles.role,
      excluded.role
    ),
    position = coalesce(
      public.profiles.position,
      excluded.position
    ),
    hire_date = coalesce(
      public.profiles.hire_date,
      excluded.hire_date
    ),
    organization_division_id = coalesce(
      public.profiles.organization_division_id,
      excluded.organization_division_id
    ),
    organization_team_id = coalesce(
      public.profiles.organization_team_id,
      excluded.organization_team_id
    ),
    organization_part_id = coalesce(
      public.profiles.organization_part_id,
      excluded.organization_part_id
    ),
    annual_salary = coalesce(
      public.profiles.annual_salary,
      excluded.annual_salary
    ),
    standard_hourly_wage = coalesce(
      public.profiles.standard_hourly_wage,
      excluded.standard_hourly_wage
    ),
    dependent_count = coalesce(
      public.profiles.dependent_count,
      excluded.dependent_count
    ),
    child_count = coalesce(
      public.profiles.child_count,
      excluded.child_count
    );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.monthly_holidays enable row level security;
alter table public.organization_divisions enable row level security;
alter table public.organization_teams enable row level security;
alter table public.organization_parts enable row level security;
alter table public.work_logs enable row level security;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "read profiles as admin" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "update profiles as admin" on public.profiles;
drop policy if exists "read system settings" on public.system_settings;
drop policy if exists "insert system settings as admin" on public.system_settings;
drop policy if exists "update system settings as admin" on public.system_settings;
drop policy if exists "read monthly holidays" on public.monthly_holidays;
drop policy if exists "insert monthly holidays as admin" on public.monthly_holidays;
drop policy if exists "update monthly holidays as admin" on public.monthly_holidays;
drop policy if exists "delete monthly holidays as admin" on public.monthly_holidays;
drop policy if exists "read organization divisions" on public.organization_divisions;
drop policy if exists "manage organization divisions as admin" on public.organization_divisions;
drop policy if exists "read organization teams" on public.organization_teams;
drop policy if exists "manage organization teams as admin" on public.organization_teams;
drop policy if exists "read organization parts" on public.organization_parts;
drop policy if exists "manage organization parts as admin" on public.organization_parts;
drop policy if exists "manage own work logs" on public.work_logs;
drop policy if exists "manage work logs as admin" on public.work_logs;

create policy "read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "read profiles as admin"
on public.profiles
for select
using (public.is_admin(auth.uid()));

create policy "insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "update profiles as admin"
on public.profiles
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "read system settings"
on public.system_settings
for select
using (auth.role() = 'authenticated');

create policy "insert system settings as admin"
on public.system_settings
for insert
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "update system settings as admin"
on public.system_settings
for update
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "read monthly holidays"
on public.monthly_holidays
for select
using (auth.role() = 'authenticated');

create policy "insert monthly holidays as admin"
on public.monthly_holidays
for insert
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "update monthly holidays as admin"
on public.monthly_holidays
for update
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "delete monthly holidays as admin"
on public.monthly_holidays
for delete
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "read organization divisions"
on public.organization_divisions
for select
using (auth.role() = 'authenticated');

create policy "manage organization divisions as admin"
on public.organization_divisions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "read organization teams"
on public.organization_teams
for select
using (auth.role() = 'authenticated');

create policy "manage organization teams as admin"
on public.organization_teams
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "read organization parts"
on public.organization_parts
for select
using (auth.role() = 'authenticated');

create policy "manage organization parts as admin"
on public.organization_parts
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "manage own work logs"
on public.work_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "manage work logs as admin"
on public.work_logs
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create index if not exists monthly_holidays_holiday_date_idx
on public.monthly_holidays (holiday_date);

create index if not exists organization_teams_division_idx
on public.organization_teams (division_id);

create index if not exists organization_parts_team_idx
on public.organization_parts (team_id);

create index if not exists work_logs_user_date_idx
on public.work_logs (user_id, work_date desc);

create unique index if not exists work_logs_user_work_date_unique_idx
on public.work_logs (user_id, work_date);

insert into storage.buckets (id, name, public)
values ('worklog-templates', 'worklog-templates', false)
on conflict (id) do update
set public = false;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'read worklog templates as admin'
  ) then
    create policy "read worklog templates as admin"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'worklog-templates'
      and public.is_admin(auth.uid())
    );
  end if;
end $$;
