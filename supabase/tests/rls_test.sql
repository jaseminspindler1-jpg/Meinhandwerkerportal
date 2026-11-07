-- Sicherheitstests für Row Level Security. Ausführen: siehe supabase/tests/run.sh
-- Jede Zeile 'Txx ... (erw X)' nennt das erwartete Ergebnis.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
-- Benutzer: K1, K2 Kunden; H1 Elektriker München, H2 Elektriker Berlin
insert into auth.users values
 ('00000000-0000-0000-0000-0000000000a1','k1@x.de','{"name":"Kunde Eins","role":"kunde","plz":"80331"}'),
 ('00000000-0000-0000-0000-0000000000a2','k2@x.de','{"name":"Kunde Zwei","role":"kunde"}'),
 ('00000000-0000-0000-0000-0000000000b1','h1@x.de','{"name":"Elektro H1","role":"handwerker","plz":"80335"}'),
 ('00000000-0000-0000-0000-0000000000b2','h2@x.de','{"name":"Elektro H2","role":"handwerker","plz":"10115"}');
update profiles set trades='{elektro}' where role='handwerker';
select 'T01 Profile angelegt: '||count(*) from profiles;

set role anon; set request.jwt.claim.sub = '';
select 'T02 anon sieht Handwerker (erw 2): '||count(*) from profiles where true;
select 'T03 anon Email lesen (erw Fehler)'; select email from profiles;
select 'T04 anon Jobs (erw Fehler)'; select count(*) from jobs;
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into jobs (title, trade, plz, description) values ('Lampen anschliessen','elektro','80333','Drei Lampen im Flur');
select 'T05 K1 eigener Job: '||count(*) from jobs;
select 'T06 K1 status direkt setzen (erw bleibt offen)'; update jobs set status='vergeben';
select 'T06 -> '||status from jobs;
select 'T07 K1 Job fuer fremden owner (erw Fehler)';
insert into jobs (owner_id,title, trade, plz, description) values ('00000000-0000-0000-0000-0000000000a2','Fake','elektro','80333','Fake fake');
select 'T08 K1 sieht nur Handwerker+sich (erw 3): '||count(*) from profiles;
select 'T09 K1 Angebot abgeben als Kunde (erw Fehler)';
insert into offers (job_id, price, start_date, message) select id, 100, '2026-12-01', 'x' from jobs;
select 'T10 K1 Email aendern (erw unveraendert)'; update profiles set email='evil@x.de', name='Neu Name';
select 'T10 -> '||email||' / '||name from profiles where id=auth.uid();
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select 'T11 K2 sieht Jobs von K1 (erw 0): '||count(*) from jobs;
select 'T12 K2 aendert Job von K1 (erw 0 Zeilen)'; update jobs set title='gehackt';
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'T13 H1 sieht offene Jobs (erw 1): '||count(*) from jobs;
select 'T14 H1 sieht Kunden-Profil vor Vergabe (erw 0): '||count(*) from profiles where role='kunde';
insert into offers (job_id, price, start_date, message) select id, 180, '2026-12-01', 'Gerne' from jobs;
select 'T15 H1 doppeltes Angebot (erw Fehler)';
insert into offers (job_id, price, start_date, message) select id, 170, '2026-12-01', 'Nochmal' from jobs;
select 'T16 H1 Angebot im Namen von H2 (erw Fehler)';
insert into offers (job_id, craftsman_id, price, start_date, message) select id,'00000000-0000-0000-0000-0000000000b2', 1, '2026-12-01', 'x' from jobs;
select 'T17 H1 nimmt eigenes Angebot an (erw Fehler)'; select accept_offer(id) from offers;
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
insert into offers (job_id, price, start_date, message) select id, 250, '2026-12-03', 'Auch gerne' from jobs;
select 'T18 H2 sieht nur eigenes Angebot (erw 1): '||count(*) from offers;
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'T19 K1 sieht Angebote (erw 2): '||count(*) from offers;
select 'T20 K1 sieht Handwerkername via Join: '||string_agg(p.name, ',' order by p.name) from offers o join profiles p on p.id=o.craftsman_id;
select accept_offer((select id from offers where price=180));
select 'T21 nach Annahme: '||status||' accepted='||(accepted_offer_id is not null) from jobs;
select 'T22 zweite Annahme (erw Fehler)'; select accept_offer((select id from offers where price=250));
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'T23 H1 sieht Kundenkontakt nach Vergabe (erw k1@x.de): '||coalesce(string_agg(email,','),'-') from profiles where role='kunde';
select 'T24 H1 sieht vergebenen Job weiter (erw 1): '||count(*) from jobs;
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select 'T25 H2 (nicht beauftragt) sieht Kundenkontakt (erw 0): '||count(*) from profiles where role='kunde';
select 'T26 H2 sieht Job (hat angeboten, erw 1): '||count(*) from jobs;
select 'T27 H2 loescht Angebot nach Vergabe (erw 0 Zeilen)'; delete from offers;
reset role;

set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into jobs (title, trade, plz, description) values ('Zweiter Auftrag','elektro','80333','Noch was machen');
select cancel_job((select id from jobs where title='Zweiter Auftrag'));
select 'T28 storniert: '||status from jobs where title='Zweiter Auftrag';
reset role;
set role anon; select 'T29 anon accept_offer (erw Fehler)'; select accept_offer(gen_random_uuid());
