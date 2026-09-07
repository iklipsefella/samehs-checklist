-- Sameh's Checklist — cloud sync schema migration
-- Project: iztscmpjmiejiitjzzsi
-- Safe to run more than once (every change is guarded / idempotent).
-- Does NOT touch RLS policies or drop any existing data.

-- 1) Widen the tasks.phase check constraint to allow all 4 app phases + 'any'.
--    (Finds whatever the existing phase check constraint is actually named and replaces it,
--    rather than assuming a name, since it may differ from what was originally documented.)
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%phase%'
  loop
    execute format('alter table public.tasks drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.tasks
  add constraint tasks_phase_check check (phase in ('any', 'morning', 'day', 'evening', 'night'));

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.routines'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%phase%'
  loop
    execute format('alter table public.routines drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.routines
  add constraint routines_phase_check check (phase in ('morning', 'day', 'evening', 'night'));

-- 2) Additive columns for lossless task sync. `data jsonb` carries the full app-side object
--    as the safety net (the app reads from `data` first, falling back to these named columns
--    only for older rows written before `data` existed).
alter table public.tasks
  add column if not exists reminder_minutes integer,
  add column if not exists original_due_date date,
  add column if not exists last_rolled_at timestamptz,
  add column if not exists waiting_note text,
  add column if not exists waiting_since timestamptz,
  add column if not exists returned_from_waiting jsonb,
  add column if not exists data jsonb,
  add column if not exists updated_at timestamptz default now();

-- 3) Additive columns for lossless routine sync.
alter table public.routines
  add column if not exists start_date date,
  add column if not exists data jsonb,
  add column if not exists updated_at timestamptz default now();

-- 4) routine_completions: add the same jsonb safety net.
alter table public.routine_completions
  add column if not exists data jsonb;

-- 5) Make sure the (routine_id, completion_date) unique constraint exists — the app upserts
--    on this conflict target to represent "checked" as row-exists / "unchecked" as row-deleted.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.routine_completions'::regclass and contype = 'u'
  ) then
    alter table public.routine_completions
      add constraint routine_completions_routine_id_completion_date_key
      unique (routine_id, completion_date);
  end if;
end $$;

-- 6) Realtime: make sure tasks/routines/routine_completions/settings are all published.
--    Wrapped so "already member of publication" doesn't abort the rest of the script.
do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.routines;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.routine_completions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.settings;
  exception when duplicate_object then null;
  end;
end $$;

-- Note: RLS is left exactly as-is (temporary anon read/write for sync testing, per the
-- handoff doc). Hardening that is a separate, later step — not part of this migration.
