"""Surgically restore ONE user's progress from a restored backup copy into prod.
Nobody else's rows are touched. Handles both pre-migration backups (rows keyed
on numeric question_id -> mapped to pdf_id exactly like backfill_pdf_id.py)
and post-migration ones (pdf_id already present).

Usage:
  SRC_DSN='postgresql://...restored-copy...' PGPW='<prod pw>' \
    python3 restore_user_from_backup.py <user_uuid> [--apply]
Without --apply it only reports what would be restored."""
import os, sys, json, psycopg2
HERE=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.join(HERE,'..','..','src','data')
UID=sys.argv[1]; APPLY='--apply' in sys.argv
banks={'arabBoard':'arab_board_master.json','boardVitals':'board_vitals_master.json','makki':'makki_master.json','etas2026':'etas_2026_master.json'}
by={k:{q['id']:q['pdf_id'] for q in json.load(open(os.path.join(DATA,f)))} for k,f in banks.items()}
def map_id(qid):
    if qid is None: return None
    if qid>=300000: return by['etas2026'].get(qid-300000)
    if qid>=200000: return by['makki'].get(qid-200000)
    if qid>=100000: return by['boardVitals'].get(qid-100000)
    if qid<=1281:   return by['arabBoard'].get(qid)
    return by['etas2026'].get(qid)
src=psycopg2.connect(os.environ['SRC_DSN']); s=src.cursor()
prod=psycopg2.connect(host="aws-0-eu-west-1.pooler.supabase.com",port=5432,user="postgres.yssrtjfgkctojkzcoapt",password=os.environ["PGPW"],dbname="postgres",sslmode="require"); prod.autocommit=True; p=prod.cursor()
def cols(cur,t):
    cur.execute("select column_name from information_schema.columns where table_schema='public' and table_name=%s order by ordinal_position",(t,)); return [r[0] for r in cur.fetchall()]
plan={}
# 1) the three keyed-on-question tables: map to pdf_id, dedupe
for t,extra in (('user_used','last_used_at'),('user_wrong','last_wrong_at'),('user_flags','flagged_at')):
    sc=cols(s,t); has_pdf='pdf_id' in sc
    s.execute(f"select {'pdf_id' if has_pdf else 'question_id'}, {extra} from public.{t} where user_id=%s",(UID,))
    rows={}
    for k,ts in s.fetchall():
        pid = k if has_pdf else map_id(k)
        if pid and pid not in rows: rows[pid]=ts
    plan[t]=rows; print(f"{t:22} {len(rows):5} rows to restore (source keyed on {'pdf_id' if has_pdf else 'question_id -> mapped'})")
# 2) tables already keyed on pdf_id / own ids: copy verbatim
for t in ('quiz_history','user_review_schedule','user_notes','user_highlights','user_flashcards'):
    sc=cols(s,t); s.execute(f"select {','.join(sc)} from public.{t} where user_id=%s",(UID,)); rows=s.fetchall()
    plan[t]=(sc,rows); print(f"{t:22} {len(rows):5} rows to restore")
if not APPLY: print("\n(dry run — nothing written; re-run with --apply)"); sys.exit(0)
n=0
for t,extra in (('user_used','last_used_at'),('user_wrong','last_wrong_at'),('user_flags','flagged_at')):
    for pid,ts in plan[t].items():
        p.execute(f"insert into public.{t} (user_id,pdf_id,{extra}) values (%s,%s,%s) on conflict (user_id,pdf_id) do nothing",(UID,pid,ts)); n+=p.rowcount
for t in ('quiz_history','user_review_schedule','user_notes','user_highlights','user_flashcards'):
    sc,rows=plan[t]
    if not rows: continue
    ph=','.join(['%s']*len(sc))
    for r in rows:
        p.execute(f"insert into public.{t} ({','.join(sc)}) values ({ph}) on conflict do nothing",r); n+=p.rowcount
print(f"\nrestored {n} rows for user {UID}")
for t in ('user_used','user_wrong','user_flags','quiz_history'):
    p.execute(f"select count(*) from public.{t} where user_id=%s",(UID,)); print(f"  {t}: {p.fetchone()[0]}")
