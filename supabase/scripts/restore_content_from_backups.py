#!/usr/bin/env python3
"""Re-insert student content (notes / highlights / mistakes / flashcards) from the
nightly backup.* snapshots wherever the live row is missing. Idempotent.
Usage: PGPW=... python3 restore_content_from_backups.py [--apply]"""
import os, sys, psycopg2
APPLY = '--apply' in sys.argv
c = psycopg2.connect(host='aws-0-eu-west-1.pooler.supabase.com', port=5432, user='postgres.yssrtjfgkctojkzcoapt',
                     password=os.environ['PGPW'], dbname='postgres', sslmode='require')
c.autocommit = False; cur = c.cursor()
STMTS = {
 'notes': """insert into public.user_notes (user_id, pdf_id, note, updated_at)
   select user_id, pdf_id, note, updated_at from (select distinct on (user_id, pdf_id) user_id, pdf_id, note, updated_at
   from backup.user_notes where coalesce(note,'') <> '' order by user_id, pdf_id, snapshot_at desc, updated_at desc) s
   where exists (select 1 from auth.users u where u.id = s.user_id) on conflict (user_id, pdf_id) do nothing""",
 'highlights': """insert into public.user_highlights (user_id, pdf_id, ranges, updated_at)
   select user_id, pdf_id, ranges, updated_at from (select distinct on (user_id, pdf_id) user_id, pdf_id, ranges, updated_at
   from backup.user_highlights where jsonb_array_length(coalesce(ranges,'[]'::jsonb)) > 0 order by user_id, pdf_id, snapshot_at desc, updated_at desc) s
   where exists (select 1 from auth.users u where u.id = s.user_id) on conflict (user_id, pdf_id) do nothing""",
 'mistakes': """insert into public.user_mistakes (user_id, pdf_id, reason, note, at)
   select user_id, pdf_id, reason, note, at from (select distinct on (user_id, pdf_id) user_id, pdf_id, reason, note, at
   from backup.user_mistakes order by user_id, pdf_id, snapshot_at desc, at desc) s
   where exists (select 1 from auth.users u where u.id = s.user_id) on conflict (user_id, pdf_id) do nothing""",
 'flashcards': """insert into public.user_flashcards (id, user_id, pdf_id, front, back, box, interval_days, due_at, reps, created_at, updated_at)
   select id, user_id, pdf_id, front, back, box, interval_days, due_at, reps, created_at, updated_at from (
   select distinct on (user_id, coalesce(pdf_id, id::text)) * from backup.user_flashcards order by user_id, coalesce(pdf_id, id::text), snapshot_at desc, updated_at desc) s
   where exists (select 1 from auth.users u where u.id = s.user_id)
   and not exists (select 1 from public.user_flashcards f where f.user_id = s.user_id and f.pdf_id is not distinct from s.pdf_id)
   on conflict (user_id, id) do nothing""",
}
for k, sql in STMTS.items():
    cur.execute(sql); print(f"{k}: {cur.rowcount} rows would be inserted" if not APPLY else f"{k}: {cur.rowcount} inserted")
if APPLY: c.commit(); print("committed")
else: c.rollback(); print("dry run — pass --apply to commit")
