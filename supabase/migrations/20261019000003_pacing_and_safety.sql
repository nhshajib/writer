-- Pace settings (target duration or typing speed, with breaks), Test
-- connection before the first insertion, and duplicate-start protection.

alter table public.drips
  add column timing_mode text not null default 'duration'
    check (timing_mode in ('duration', 'speed', 'asap')),
  -- The pace settings the schedule was built from (no text).
  add column pacing jsonb,
  -- Planned breaks: [{ after_index, start_ms, duration_ms }], offsets like `schedule`.
  add column breaks jsonb not null default '[]'::jsonb check (jsonb_typeof(breaks) = 'array'),
  -- Set by the client once per Start press, so a repeated request can't start twice.
  add column request_id uuid,
  -- When the Test connection before the first insertion passed.
  add column preflight_at timestamptz;

update public.drips set timing_mode = 'asap' where mode = 'as_soon_as_possible';

-- Sessions that started before the Test connection existed don't need one.
update public.drips set preflight_at = coalesce(session_started_at, created_at) where chunks_written > 0;

alter table public.drips drop constraint drips_attention_check;
alter table public.drips add constraint drips_attention_check check (attention in (
  'document_changed', 'confirm_last_part', 'reconnect', 'document_unavailable', 'unreachable', 'insert_rejected',
  'not_editable'
));

-- One Start press makes at most one session.
create unique index drips_request_idx on public.drips (user_id, request_id) where request_id is not null;

-- At most one unfinished session per document, so two can't write into it at once.
create unique index drips_one_active_per_document on public.drips (connection_id, document_id)
  where status in ('scheduled', 'running', 'paused');

-- Start requests seen, recorded before a new document is created, so a repeated
-- request can't create a second document either.
create table public.start_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.start_requests enable row level security;
-- No policies: service role only.
