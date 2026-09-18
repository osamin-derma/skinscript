"""Backfill user_used / user_wrong / user_flags.pdf_id from the legacy numeric
question_id, then finalize migration 12. Usage:
    PGPW=... python3 backfill_pdf_id.py --dry-run   # report only
    PGPW=... python3 backfill_pdf_id.py --apply     # run phase A, backfill, phase B
Mapping: offset ids (+100k/+200k/+300k, from the "All" bank) map EXACTLY.
Raw ids are ambiguous (every bank starts at 1); best-effort: <=1281 -> Arab
Board (the un-offset segment of the default "All" bank), >1281 -> ETAS (the
only/largest bank with those ids)."""
import os, sys, json, re, psycopg2
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'src', 'data')
banks = {'arabBoard':'arab_board_master.json','boardVitals':'board_vitals_master.json',
         'makki':'makki_master.json','etas2026':'etas_2026_master.json'}
by = {k: {q['id']: q['pdf_id'] for q in json.load(open(os.path.join(DATA,f)))} for k,f in banks.items()}
OFF = {'boardVitals':100000,'makki':200000,'etas2026':300000}
def map_id(qid):
    if qid >= 300000: return by['etas2026'].get(qid-300000), 'exact'
    if qid >= 200000: return by['makki'].get(qid-200000), 'exact'
    if qid >= 100000: return by['boardVitals'].get(qid-100000), 'exact'
    if qid <= 1281:   return by['arabBoard'].get(qid), 'best-effort'
    return by['etas2026'].get(qid), 'best-effort'
apply = '--apply' in sys.argv
conn = psycopg2.connect(host="aws-0-eu-west-1.pooler.supabase.com", port=5432,
    user="postgres.yssrtjfgkctojkzcoapt", password=os.environ["PGPW"],
    dbname="postgres", sslmode="require", connect_timeout=15)
conn.autocommit = True; cur = conn.cursor()
sql = open(os.path.join(HERE,'..','12_user_progress_pdf_id.sql')).read()
phaseA, phaseB = sql.split('-- ═══ Phase B')
if apply: cur.execute(phaseA); print("phase A: pdf_id columns added")
for t in ('user_used','user_wrong','user_flags'):
    # Before phase A the column doesn't exist yet, so a dry run reads every row.
    where = " where pdf_id is null" if apply else ""
    cur.execute(f"select ctid, user_id, question_id from public.{t}{where}")
    rows = cur.fetchall(); exact=best=unmapped=0; updates=[]
    seen=set(); dups=0
    for ctid,uid,qid in rows:
        pid,kind = map_id(qid)
        if not pid: unmapped+=1; continue
        if kind=='exact': exact+=1
        else: best+=1
        if (uid,pid) in seen: dups+=1
        seen.add((uid,pid)); updates.append((pid,ctid))
    print(f"{t:11} rows={len(rows):5}  exact={exact:5}  best-effort={best:5}  unmapped={unmapped}  will-merge-as-duplicates={dups}")
    if apply:
        cur.executemany(f"update public.{t} set pdf_id=%s where ctid=%s", updates)
if apply:
    cur.execute('-- ═══ Phase B' + phaseB); print("phase B: deduped + primary key now (user_id, pdf_id)")
    for t in ('user_used','user_wrong','user_flags'):
        cur.execute(f"select count(*), count(distinct user_id) from public.{t}"); print(f"  {t}: {cur.fetchone()}")
else:
    print("(dry run — nothing changed; re-run with --apply)")
cur.close(); conn.close()
