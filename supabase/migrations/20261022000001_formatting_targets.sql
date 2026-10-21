-- Pro: keep formatting (Markdown headings, bold, italic, bullets) and add text
-- under a chosen heading. The units stay plain text; the formatting of each
-- unit and the heading to add under are stored next to them.

alter table public.drips
  add column text_format text not null default 'plain' check (text_format in ('plain', 'markdown')),
  add column chunk_formats jsonb,
  add column insert_target jsonb;

alter table public.drips drop constraint drips_attention_check;
alter table public.drips add constraint drips_attention_check check (attention in (
  'document_changed', 'confirm_last_part', 'reconnect', 'document_unavailable', 'unreachable', 'insert_rejected',
  'not_editable', 'heading_missing'
));
