-- 16_question_translations.sql — shared cache of AI translations (Arabic / Russian)
-- of question stems, choices and explanations. Written ONLY by the `tutor` edge
-- function (service role); every signed-in student can read, so each question
-- is translated at most once per language, whoever asks first.
create table if not exists public.question_translations (
  pdf_id     text not null,
  lang       text not null check (lang in ('ar', 'ru')),
  part       text not null check (part in ('question', 'explanation')),
  payload    jsonb not null,
  model      text,
  created_at timestamptz not null default now(),
  primary key (pdf_id, lang, part)
);
alter table public.question_translations enable row level security;
drop policy if exists "translations_read" on public.question_translations;
create policy "translations_read" on public.question_translations for select to authenticated using (true);
grant select on public.question_translations to authenticated;
