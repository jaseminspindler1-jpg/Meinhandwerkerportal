-- =====================================================================
-- Mein Handwerkerportal – Datenbankschema für Supabase
-- Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Das Skript kann gefahrlos erneut ausgeführt werden.
-- =====================================================================

-- ---------- Tabellen ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'kunde' check (role in ('kunde', 'handwerker')),
  name        text not null default '' check (char_length(name) <= 120),
  email       text,
  phone       text check (char_length(phone) <= 40),
  plz         text check (plz ~ '^\d{5}$'),
  city        text check (char_length(city) <= 80),
  about       text check (char_length(about) <= 2000),
  trades      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.jobs (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title                text not null check (char_length(title) between 3 and 80),
  trade                text not null,
  plz                  text not null check (plz ~ '^\d{5}$'),
  description          text not null check (char_length(description) between 5 and 5000),
  when_text            text check (char_length(when_text) <= 80),
  budget               text check (char_length(budget) <= 80),
  direct_craftsman_id  uuid references public.profiles (id) on delete set null,
  status               text not null default 'offen' check (status in ('offen', 'vergeben', 'storniert')),
  accepted_offer_id    uuid,
  created_at           timestamptz not null default now()
);

create table if not exists public.offers (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  craftsman_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  price         numeric(10, 2) not null check (price > 0),
  start_date    date not null,
  message       text not null check (char_length(message) between 1 and 3000),
  created_at    timestamptz not null default now(),
  unique (job_id, craftsman_id)
);

do $$ begin
  alter table public.jobs
    add constraint jobs_accepted_offer_fk foreign key (accepted_offer_id)
    references public.offers (id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists jobs_owner_idx   on public.jobs (owner_id);
create index if not exists jobs_open_idx    on public.jobs (trade, plz) where status = 'offen';
create index if not exists offers_job_idx   on public.offers (job_id);
create index if not exists offers_craft_idx on public.offers (craftsman_id);
create index if not exists profiles_craft_idx on public.profiles using gin (trades) where role = 'handwerker';

-- ---------- Hilfsfunktionen (umgehen RLS, um Rekursion zu vermeiden) ----------

create or replace function public.is_handwerker() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'handwerker');
$$;

create or replace function public.owns_job(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jobs where id = j and owner_id = auth.uid());
$$;

create or replace function public.has_offered(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from offers where job_id = j and craftsman_id = auth.uid());
$$;

create or replace function public.job_is_open(j uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jobs where id = j and status = 'offen');
$$;

-- Kunde, dessen Auftrag an mich (Handwerker) vergeben wurde -> Kontaktdaten sichtbar
create or replace function public.is_my_client(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs j join offers o on o.id = j.accepted_offer_id
    where j.owner_id = p and o.craftsman_id = auth.uid()
  );
$$;

-- ---------- Profil automatisch bei Registrierung anlegen ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, role, plz)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'handwerker' then 'handwerker' else 'kunde' end,
    case when (new.raw_user_meta_data ->> 'plz') ~ '^\d{5}$' then new.raw_user_meta_data ->> 'plz' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Schutz vor Manipulation ----------

-- E-Mail im Profil darf nicht frei geändert werden (kommt aus dem Login)
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Auftraggeber darf Vergabe/Status nicht direkt setzen (nur über accept_offer / cancel_job)
create or replace function public.protect_job() returns trigger
language plpgsql as $$
begin
  -- Normale Benutzer (anon/authenticated); die Aktionen unten laufen als Eigentümer
  if current_user in ('anon', 'authenticated') then
    new.status := old.status;
    new.accepted_offer_id := old.accepted_offer_id;
  end if;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists protect_job on public.jobs;
create trigger protect_job before update on public.jobs
  for each row execute function public.protect_job();

-- ---------- Aktionen ----------

create or replace function public.accept_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  select o.job_id into v_job
  from offers o join jobs j on j.id = o.job_id
  where o.id = p_offer_id and j.owner_id = auth.uid() and j.status = 'offen'
  for update of j;
  if v_job is null then
    raise exception 'Angebot nicht gefunden oder Auftrag nicht mehr offen';
  end if;
  update jobs set status = 'vergeben', accepted_offer_id = p_offer_id where id = v_job;
end $$;

create or replace function public.cancel_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update jobs set status = 'storniert'
  where id = p_job_id and owner_id = auth.uid() and status = 'offen';
  if not found then raise exception 'Auftrag nicht gefunden oder nicht mehr offen'; end if;
end $$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.jobs     enable row level security;
alter table public.offers   enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (
  role = 'handwerker'            -- Handwerker-Profile sind öffentlich (Suche)
  or id = auth.uid()             -- eigenes Profil
  or public.is_my_client(id)     -- Kunde nach Vergabe an mich
);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select" on public.jobs for select using (
  owner_id = auth.uid()
  or (status = 'offen' and public.is_handwerker())
  or public.has_offered(id)
);

drop policy if exists "jobs_insert" on public.jobs;
create policy "jobs_insert" on public.jobs for insert
  with check (owner_id = auth.uid() and status = 'offen' and accepted_offer_id is null);

drop policy if exists "jobs_update" on public.jobs;
create policy "jobs_update" on public.jobs for update
  using (owner_id = auth.uid() and status = 'offen') with check (owner_id = auth.uid());

drop policy if exists "offers_select" on public.offers;
create policy "offers_select" on public.offers for select using (
  craftsman_id = auth.uid() or public.owns_job(job_id)
);

drop policy if exists "offers_insert" on public.offers;
create policy "offers_insert" on public.offers for insert with check (
  craftsman_id = auth.uid()
  and public.is_handwerker()
  and public.job_is_open(job_id)
  and not public.owns_job(job_id)
);

drop policy if exists "offers_delete" on public.offers;
create policy "offers_delete" on public.offers for delete using (
  craftsman_id = auth.uid() and public.job_is_open(job_id)
);

-- ---------- Rechte ----------

revoke all on public.profiles, public.jobs, public.offers from anon;
-- Handwerkersuche ohne Login (ohne E-Mail-Adressen)
grant select (id, role, name, phone, plz, city, about, trades, created_at) on public.profiles to anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select, insert, delete on public.offers to authenticated;
revoke execute on function public.accept_offer(uuid), public.cancel_job(uuid) from public, anon;
grant execute on function public.accept_offer(uuid), public.cancel_job(uuid) to authenticated;
