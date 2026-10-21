-- Approval record, insertion unit and timing mode for each drip.

alter table public.drips
  add column insertion_unit text not null default 'chunk'
    check (insertion_unit in ('chunk', 'sentence', 'paragraph')),
  add column mode text not null default 'scheduled'
    check (mode in ('scheduled', 'as_soon_as_possible')),
  add column text_sha256 text,
  add column approved_at timestamptz;
