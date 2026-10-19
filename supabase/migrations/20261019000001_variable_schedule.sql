-- Persist the generated insertion schedule so retries, pauses, and resumes use
-- the same approved plan instead of generating a new pace.

alter table public.drips
  add column schedule jsonb not null default '[]'::jsonb
    check (jsonb_typeof(schedule) = 'array'),
  add column schedule_shift_seconds integer not null default 0
    check (schedule_shift_seconds >= 0),
  add column session_started_at timestamptz,
  add column paused_at timestamptz,
  add column deadline_at timestamptz,
  add column document_baseline_length integer,
  add column document_baseline_sha256 text
