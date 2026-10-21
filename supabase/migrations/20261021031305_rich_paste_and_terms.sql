-- Rich source is structured text and style ranges in the existing text column.
-- Existing plain/Markdown sessions and their saved execution scripts are unchanged.
alter table public.drips drop constraint if exists drips_text_format_check;
alter table public.drips add constraint drips_text_format_check
  check (text_format in ('plain', 'markdown', 'rich'));
