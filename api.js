/* Datenzugriff für Mein Handwerkerportal.
 * Zwei austauschbare Implementierungen mit derselben Schnittstelle:
 *  - SupabaseApi: echtes Backend (Login, Postgres, Row Level Security)
 *  - DemoApi:     läuft ohne Server, Daten nur im localStorage dieses Geräts
 * Alle Methoden sind async und liefern dieselben, "normalisierten" Objekte. */
'use strict';

const TRADES = [
  { id: 'elektro', name: 'Elektriker', emoji: '⚡' },
  { id: 'sanitaer', name: 'Sanitär & Heizung', emoji: '🚿' },
  { id: 'maler', name: 'Maler & Lackierer', emoji: '🎨' },
  { id: 'tischler', name: 'Tischler / Schreiner', emoji: '🪚' },
  { id: 'dach', name: 'Dachdecker', emoji: '🏠' },
  { id: 'fliesen', name: 'Fliesenleger', emoji: '🧱' },
  { id: 'garten', name: 'Garten & Landschaft', emoji: '🌳' },
  { id: 'umzug', name: 'Umzug & Montage', emoji: '📦' },
];

const regionPrefix = (plz) => (/^\d{2}/.test(plz || '') ? plz.slice(0, 2) : '');

/* =====================================================================
 * Supabase
 * ===================================================================== */
const CRAFT_COLS = 'id, name, phone, plz, city, about, trades';

class SupabaseApi {
  constructor(url, key) {
    this.mode = 'supabase';
    this.sb = window.supabase.createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } });
    this.session = null;
  }

  async init(onChange) {
    const { data } = await this.sb.auth.getSession();
    await this._loadSession(data.session);
    this.sb.auth.onAuthStateChange((event, session) => {
      // Profil nachladen, aber nicht innerhalb des Callbacks awaiten (Supabase-Empfehlung)
      setTimeout(async () => {
        await this._loadSession(session);
        onChange(event);
      }, 0);
    });
  }

  async _loadSession(session) {
    if (!session) { this.session = null; return; }
    const { data: profile } = await this.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    this.session = {
      user: { id: session.user.id, email: session.user.email },
      profile: profile || { role: 'kunde', name: '', trades: [] },
    };
  }

  _uid() { return this.session?.user.id; }
  _check({ data, error }) {
    if (error) throw new Error(translateError(error.message));
    return data;
  }

  // ----- Auth -----
  async signUp({ email, password, name, role, plz }) {
    const res = await this.sb.auth.signUp({
      email, password,
      options: { data: { name, role, plz }, emailRedirectTo: location.origin + location.pathname },
    });
    const data = this._check(res);
    await this._loadSession(data.session);
    return { needsConfirmation: !data.session };
  }
  async signIn({ email, password }) {
    const data = this._check(await this.sb.auth.signInWithPassword({ email, password }));
    await this._loadSession(data.session);
  }
  async signOut() { await this.sb.auth.signOut(); this.session = null; }
  async resetPassword(email) {
    this._check(await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
  }
  async updatePassword(password) { this._check(await this.sb.auth.updateUser({ password })); }

  // ----- Profile -----
  async updateProfile(fields) {
    const row = pick(fields, ['name', 'phone', 'plz', 'city', 'about', 'trades', 'role']);
    const data = this._check(await this.sb.from('profiles').update(row).eq('id', this._uid()).select().single());
    this.session.profile = data;
  }

  async searchCraftsmen({ trade, plz }) {
    let q = this.sb.from('profiles').select(CRAFT_COLS).eq('role', 'handwerker').neq('name', '');
    if (trade) q = q.contains('trades', [trade]);
    if (regionPrefix(plz)) q = q.like('plz', regionPrefix(plz) + '%');
    return this._check(await q.order('name').limit(100)).map(normCraftsman);
  }

  async getCraftsman(id) {
    const data = this._check(await this.sb.from('profiles').select(CRAFT_COLS).eq('id', id).eq('role', 'handwerker').maybeSingle());
    return data && normCraftsman(data);
  }

  // ----- Aufträge -----
  async createJob(j) {
    const row = {
      title: j.title, trade: j.trade, plz: j.plz, description: j.description,
      when_text: j.when || null, budget: j.budget || null, direct_craftsman_id: j.directId || null,
    };
    return normJob(this._check(await this.sb.from('jobs').insert(row).select().single()));
  }

  async myJobs() {
    const rows = this._check(await this.sb.from('jobs')
      .select('*, offers!offers_job_id_fkey(count)').eq('owner_id', this._uid())
      .order('created_at', { ascending: false }));
    return rows.map(normJob);
  }

  async openJobsForMe() {
    const p = this.session.profile;
    const uid = this._uid();
    const sel = '*, offers!offers_job_id_fkey(count)';
    const lists = [];
    if (p.trades?.length && regionPrefix(p.plz)) {
      lists.push(this._check(await this.sb.from('jobs').select(sel)
        .eq('status', 'offen').in('trade', p.trades).like('plz', regionPrefix(p.plz) + '%')
        .neq('owner_id', uid).order('created_at', { ascending: false }).limit(100)));
    }
    lists.push(this._check(await this.sb.from('jobs').select(sel)
      .eq('status', 'offen').eq('direct_craftsman_id', uid).order('created_at', { ascending: false })));
    const seen = new Set();
    return lists.flat().filter((r) => !seen.has(r.id) && seen.add(r.id)).map(normJob)
      .sort((a, b) => b.created - a.created);
  }

  async myOffers() {
    const rows = this._check(await this.sb.from('offers')
      .select('*, job:jobs!offers_job_id_fkey(*)').eq('craftsman_id', this._uid())
      .order('created_at', { ascending: false }));
    return rows.map((o) => ({ ...normOffer(o), job: normJob(o.job) }));
  }

  async getJob(id) {
    const row = this._check(await this.sb.from('jobs')
      .select(`*, offers!offers_job_id_fkey(*, craftsman:profiles(${CRAFT_COLS}))`).eq('id', id).maybeSingle());
    if (!row) return null;
    const job = normJob(row);
    job.offers = (row.offers || []).map(normOffer).sort((a, b) => a.price - b.price);
    const mine = job.offers.find((o) => o.craftsmanId === this._uid());
    if (mine && job.acceptedOffer === mine.id) {
      job.client = this._check(await this.sb.from('profiles').select('name, email, phone').eq('id', job.ownerId).maybeSingle());
    }
    return job;
  }

  async createOffer(jobId, { price, date, message }) {
    this._check(await this.sb.from('offers').insert({ job_id: jobId, price, start_date: date, message }));
  }
  async withdrawOffer(offerId) {
    this._check(await this.sb.from('offers').delete().eq('id', offerId));
  }
  async acceptOffer(_jobId, offerId) {
    this._check(await this.sb.rpc('accept_offer', { p_offer_id: offerId }));
  }
  async cancelJob(jobId) {
    this._check(await this.sb.rpc('cancel_job', { p_job_id: jobId }));
  }
}

function normCraftsman(r) {
  return { id: r.id, name: r.name, trades: r.trades || [], plz: r.plz || '', city: r.city || '', phone: r.phone || '', about: r.about || '' };
}
function normJob(r) {
  return {
    id: r.id, ownerId: r.owner_id, title: r.title, trade: r.trade, plz: r.plz, description: r.description,
    when: r.when_text || '', budget: r.budget || '', directId: r.direct_craftsman_id, status: r.status,
    acceptedOffer: r.accepted_offer_id, created: Date.parse(r.created_at),
    offerCount: Array.isArray(r.offers) ? (r.offers[0]?.count ?? r.offers.length) : 0,
  };
}
function normOffer(o) {
  return {
    id: o.id, jobId: o.job_id, craftsmanId: o.craftsman_id, price: Number(o.price), date: o.start_date,
    message: o.message, created: Date.parse(o.created_at), craftsman: o.craftsman ? normCraftsman(o.craftsman) : null,
  };
}
function pick(o, keys) {
  return Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k] === '' ? null : o[k]]));
}
function translateError(msg) {
  const map = [
    [/Invalid login credentials/i, 'E-Mail oder Passwort ist falsch.'],
    [/Email not confirmed/i, 'Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail).'],
    [/User already registered/i, 'Für diese E-Mail-Adresse gibt es bereits ein Konto.'],
    [/Password should be at least/i, 'Das Passwort ist zu kurz (mindestens 8 Zeichen).'],
    [/rate limit/i, 'Zu viele Versuche – bitte kurz warten und erneut versuchen.'],
    [/duplicate key.*offers_job_id_craftsman_id/i, 'Du hast für diesen Auftrag bereits ein Angebot abgegeben.'],
    [/row-level security/i, 'Dafür fehlt die Berechtigung.'],
    [/Failed to fetch|NetworkError/i, 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.'],
  ];
  const hit = map.find(([re]) => re.test(msg));
  return hit ? hit[1] : msg;
}

/* =====================================================================
 * Demo (ohne Server)
 * ===================================================================== */
const DEMO_KEY = 'mhp-demo-v2';
const DAY = 864e5;
const demoSeed = () => ({
  role: 'kunde',
  customer: { id: 'me', name: 'Max Mustermann', email: 'max@example.de', phone: '0170 1234567', plz: '80331', city: 'München', role: 'kunde', trades: [] },
  myCraftsmanId: 'h1',
  craftsmen: [
    { id: 'h1', name: 'Elektro Huber GmbH', trades: ['elektro'], plz: '80335', city: 'München', about: 'Elektroinstallationen, Smart Home, E-Mobilität und Photovoltaik. Meisterbetrieb seit 1998.', phone: '089 1234567' },
    { id: 'h2', name: 'Bad & Wärme Schmid', trades: ['sanitaer'], plz: '80469', city: 'München', about: 'Badsanierung aus einer Hand, Heizungstausch, Wärmepumpen und Notdienst.', phone: '089 2345678' },
    { id: 'h3', name: 'Malerwerkstatt Bauer', trades: ['maler'], plz: '81541', city: 'München', about: 'Innen- und Fassadenanstrich, Tapezierarbeiten, Lackierungen.', phone: '089 3456789' },
    { id: 'h4', name: 'Holzkunst Wagner', trades: ['tischler'], plz: '85221', city: 'Dachau', about: 'Möbel nach Maß, Küchen, Innentüren und Treppen.', phone: '08131 456789' },
    { id: 'h5', name: 'Dach & Fassade Maier', trades: ['dach'], plz: '86150', city: 'Augsburg', about: 'Dachsanierung, Dachfenster, Spenglerarbeiten und Reparaturen.', phone: '0821 567890' },
    { id: 'h6', name: 'Fliesen Yilmaz', trades: ['fliesen'], plz: '80637', city: 'München', about: 'Fliesen, Naturstein und barrierefreie Duschen.', phone: '089 6789012' },
    { id: 'h7', name: 'Grünwerk Fischer', trades: ['garten'], plz: '82008', city: 'Unterhaching', about: 'Gartengestaltung, Pflasterarbeiten, Baumpflege.', phone: '089 7890123' },
    { id: 'h8', name: 'Schnell & Sicher Umzüge', trades: ['umzug'], plz: '10115', city: 'Berlin', about: 'Privat- und Firmenumzüge, Möbelmontage, Entrümpelung.', phone: '030 8901234' },
    { id: 'h9', name: 'Haustechnik Keller', trades: ['sanitaer', 'elektro'], plz: '10245', city: 'Berlin', about: 'Sanitär, Heizung und Elektro aus einer Hand.', phone: '030 9012345' },
  ],
  jobs: [
    { id: 'j1', ownerId: 'other', title: 'Steckdosen im Wohnzimmer erneuern', trade: 'elektro', plz: '80333', description: '6 alte Steckdosen gegen neue tauschen, eine zusätzliche Doppelsteckdose setzen.', when: 'In den nächsten 2 Wochen', budget: 'bis 400 €', status: 'offen', acceptedOffer: null, directId: null, created: Date.now() - 2 * DAY },
    { id: 'j2', ownerId: 'other', title: 'Wallbox in Garage installieren', trade: 'elektro', plz: '80999', description: '11 kW Wallbox vorhanden, Leitungsweg ca. 15 m vom Zählerschrank.', when: 'Flexibel', budget: '', status: 'offen', acceptedOffer: null, directId: null, created: Date.now() - 5 * DAY },
  ],
  offers: [],
});

class DemoApi {
  constructor() {
    this.mode = 'demo';
    try { this.db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (_) { this.db = null; }
    if (!this.db) this.db = demoSeed();
  }
  async init() { this._syncSession(); }
  _save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch (_) { /* ignore */ } }
  _syncSession() {
    const isPro = this.db.role === 'handwerker';
    const p = isPro ? { ...this.db.craftsmen.find((c) => c.id === this.db.myCraftsmanId), role: 'handwerker', email: 'info@elektro-huber.example' } : this.db.customer;
    this.session = { user: { id: p.id, email: p.email }, profile: p };
  }
  _uid() { return this.session.user.id; }
  _craft(id) { return this.db.craftsmen.find((c) => c.id === id) || null; }
  _withCount(j) { return { ...j, offerCount: this.db.offers.filter((o) => o.jobId === j.id && (this.db.role !== 'handwerker' || o.craftsmanId === this._uid())).length }; }

  setRole(role) { this.db.role = role; this._save(); this._syncSession(); }
  reset() { this.db = demoSeed(); this._save(); this._syncSession(); }

  async signUp() { throw new Error('Im Demo-Modus gibt es keine Anmeldung.'); }
  async signIn() { throw new Error('Im Demo-Modus gibt es keine Anmeldung.'); }
  async signOut() {}
  async resetPassword() {}
  async updatePassword() {}

  async updateProfile(f) {
    if (this.db.role === 'handwerker') Object.assign(this._craft(this.db.myCraftsmanId), pick(f, ['name', 'phone', 'plz', 'city', 'about', 'trades']));
    else Object.assign(this.db.customer, pick(f, ['name', 'phone', 'plz', 'city']));
    if (f.role && f.role !== this.db.role) this.db.role = f.role;
    this._save(); this._syncSession();
  }
  async searchCraftsmen({ trade, plz }) {
    const pre = regionPrefix(plz);
    return this.db.craftsmen.filter((c) => (!trade || c.trades.includes(trade)) && (!pre || c.plz.startsWith(pre)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  async getCraftsman(id) { return this._craft(id); }

  async createJob(j) {
    const job = { id: 'j' + Date.now().toString(36), ownerId: 'me', title: j.title, trade: j.trade, plz: j.plz, description: j.description, when: j.when, budget: j.budget, directId: j.directId || null, status: 'offen', acceptedOffer: null, created: Date.now() };
    this.db.jobs.push(job); this._save();
    return job;
  }
  async myJobs() {
    return this.db.jobs.filter((j) => j.ownerId === 'me').map((j) => this._withCount(j)).sort((a, b) => b.created - a.created);
  }
  async openJobsForMe() {
    const p = this.session.profile; const pre = regionPrefix(p.plz);
    return this.db.jobs.filter((j) => j.status === 'offen' && j.ownerId !== this._uid() &&
      ((p.trades.includes(j.trade) && pre && j.plz.startsWith(pre)) || j.directId === this._uid()))
      .map((j) => this._withCount(j)).sort((a, b) => b.created - a.created);
  }
  async myOffers() {
    return this.db.offers.filter((o) => o.craftsmanId === this._uid())
      .map((o) => ({ ...o, job: this.db.jobs.find((j) => j.id === o.jobId) })).sort((a, b) => b.created - a.created);
  }
  async getJob(id) {
    const j = this.db.jobs.find((x) => x.id === id);
    if (!j) return null;
    const isPro = this.db.role === 'handwerker';
    let offers = this.db.offers.filter((o) => o.jobId === id);
    if (isPro) offers = offers.filter((o) => o.craftsmanId === this._uid());
    else if (j.ownerId !== 'me') offers = [];
    const job = { ...j, offers: offers.map((o) => ({ ...o, craftsman: this._craft(o.craftsmanId) })).sort((a, b) => a.price - b.price) };
    const mine = job.offers.find((o) => o.craftsmanId === this._uid());
    if (mine && j.acceptedOffer === mine.id && j.ownerId === 'me') job.client = pick(this.db.customer, ['name', 'email', 'phone']);
    return job;
  }
  async createOffer(jobId, { price, date, message }) {
    if (this.db.offers.some((o) => o.jobId === jobId && o.craftsmanId === this._uid())) throw new Error('Du hast für diesen Auftrag bereits ein Angebot abgegeben.');
    this.db.offers.push({ id: 'o' + Date.now().toString(36), jobId, craftsmanId: this._uid(), price, date, message, created: Date.now() });
    this._save();
  }
  async withdrawOffer(offerId) { this.db.offers = this.db.offers.filter((o) => o.id !== offerId); this._save(); }
  async acceptOffer(jobId, offerId) {
    const j = this.db.jobs.find((x) => x.id === jobId);
    if (!j || j.status !== 'offen') throw new Error('Auftrag ist nicht mehr offen.');
    j.status = 'vergeben'; j.acceptedOffer = offerId; this._save();
  }
  async cancelJob(jobId) {
    const j = this.db.jobs.find((x) => x.id === jobId);
    if (j && j.status === 'offen') { j.status = 'storniert'; this._save(); }
  }
}

function createApi() {
  const cfg = window.MHP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) return new SupabaseApi(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return new DemoApi();
}
