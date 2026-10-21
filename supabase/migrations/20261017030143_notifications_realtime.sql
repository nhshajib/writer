-- In-app notifications, an email preference, and Realtime for live progress.

-- Users can switch their own email notifications off. Column-level grant only:
-- without it the update policy below would also let them edit `plan`.
alter table public.profiles add column email_notifications boolean not null default true;

revoke update on public.profiles from anon, authenticated;
grant update (email_notifications) on public.profiles to authenticated;

create policy "profiles: owner can update preferences"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  drip_id uuid references public.drips (id) on delete cascade,
  kind text not null check (kind in ('drip_completed', 'drip_failed')),
  title text not null,
  body text not null,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- one notification per drip and outcome, even if the worker retries
  unique (drip_id, kind)
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: owner can read"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Owners can mark their own notifications read, and nothing else.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: owner can mark read"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Live updates. drip_events is published instead of drips: drips rows carry the
-- full text and would make every update payload large. Each chunk_written event
-- already includes written / total / next_run_at.
alter publication supabase_realtime add table public.drip_events, public.notifications;
