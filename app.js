/* Mein Handwerkerportal – Prototyp (PWA, ohne Backend).
 * Daten liegen im localStorage des Geräts. Für den echten Betrieb wird später
 * ein Backend (Benutzerkonten, Datenbank, Benachrichtigungen) angebunden. */
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
const tradeById = (id) => TRADES.find((t) => t.id === id) || { name: id, emoji: '🔧' };

const SEED = {
  version: 1,
  role: 'kunde',
  me: { name: 'Max Mustermann', plz: '80331', email: 'max@example.de' },
  myCraftsmanId: 'h1',
  craftsmen: [
    { id: 'h1', name: 'Elektro Huber GmbH', trades: ['elektro'], plz: '80335', city: 'München', rating: 4.8, reviews: 126, about: 'Elektroinstallationen, Smart Home, E-Mobilität und Photovoltaik. Meisterbetrieb seit 1998.', phone: '089 1234567' },
    { id: 'h2', name: 'Bad & Wärme Schmid', trades: ['sanitaer'], plz: '80469', city: 'München', rating: 4.6, reviews: 88, about: 'Badsanierung aus einer Hand, Heizungstausch, Wärmepumpen und Notdienst.', phone: '089 2345678' },
    { id: 'h3', name: 'Malerwerkstatt Bauer', trades: ['maler'], plz: '81541', city: 'München', rating: 4.9, reviews: 64, about: 'Innen- und Fassadenanstrich, Tapezierarbeiten, Lackierungen.', phone: '089 3456789' },
    { id: 'h4', name: 'Holzkunst Wagner', trades: ['tischler'], plz: '85221', city: 'Dachau', rating: 4.7, reviews: 41, about: 'Möbel nach Maß, Küchen, Innentüren und Treppen.', phone: '08131 456789' },
    { id: 'h5', name: 'Dach & Fassade Maier', trades: ['dach'], plz: '86150', city: 'Augsburg', rating: 4.5, reviews: 57, about: 'Dachsanierung, Dachfenster, Spenglerarbeiten und Reparaturen.', phone: '0821 567890' },
    { id: 'h6', name: 'Fliesen Yilmaz', trades: ['fliesen'], plz: '80637', city: 'München', rating: 4.8, reviews: 73, about: 'Fliesen, Naturstein und barrierefreie Duschen.', phone: '089 6789012' },
    { id: 'h7', name: 'Grünwerk Fischer', trades: ['garten'], plz: '82008', city: 'Unterhaching', rating: 4.4, reviews: 29, about: 'Gartengestaltung, Pflasterarbeiten, Baumpflege.', phone: '089 7890123' },
    { id: 'h8', name: 'Schnell & Sicher Umzüge', trades: ['umzug'], plz: '10115', city: 'Berlin', rating: 4.3, reviews: 112, about: 'Privat- und Firmenumzüge, Möbelmontage, Entrümpelung.', phone: '030 8901234' },
    { id: 'h9', name: 'Haustechnik Keller', trades: ['sanitaer', 'elektro'], plz: '10245', city: 'Berlin', rating: 4.6, reviews: 95, about: 'Sanitär, Heizung und Elektro aus einer Hand.', phone: '030 9012345' },
  ],
  jobs: [
    { id: 'j1', title: 'Steckdosen im Wohnzimmer erneuern', trade: 'elektro', plz: '80333', description: '6 alte Steckdosen gegen neue tauschen, eine zusätzliche Doppelsteckdose setzen.', when: 'In den nächsten 2 Wochen', budget: 'bis 400 €', owner: 'other', created: Date.now() - 864e5 * 2, status: 'offen', offers: [] },
    { id: 'j2', title: 'Wallbox in Garage installieren', trade: 'elektro', plz: '80999', description: '11 kW Wallbox vorhanden, Leitungsweg ca. 15 m vom Zählerschrank.', when: 'Flexibel', budget: '', owner: 'other', created: Date.now() - 864e5 * 5, status: 'offen', offers: [] },
  ],
};

const STORE_KEY = 'mhp-state-v1';
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return structuredClone(SEED);
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const sameRegion = (a, b) => !a || !b || String(a).slice(0, 2) === String(b).slice(0, 2);
const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const euro = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const craftsman = (id) => state.craftsmen.find((c) => c.id === id);
const job = (id) => state.jobs.find((j) => j.id === id);

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Routing ---------- */
function parseHash() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(query) };
}
const go = (h) => { location.hash = h; };

const routes = {
  '': home,
  suche: search,
  handwerker: craftsmanDetail,
  'auftrag-neu': newJob,
  'meine-auftraege': myJobs,
  auftraege: openJobs,
  auftrag: jobDetail,
  profil: profile,
};

function render() {
  const { parts, q } = parseHash();
  const view = routes[parts[0] || ''] || notFound;
  document.getElementById('view').innerHTML = view(parts.slice(1), q);
  renderChrome(parts[0] || '');
  bind(parts, q);
  window.scrollTo(0, 0);
}

function renderChrome(current) {
  const isPro = state.role === 'handwerker';
  document.getElementById('roleToggle').textContent = isPro ? '🧰 Handwerker' : '👤 Kunde';
  const tabs = isPro
    ? [['', '🏠', 'Start'], ['auftraege', '📋', 'Aufträge'], ['profil', '🧰', 'Mein Betrieb']]
    : [['', '🏠', 'Start'], ['suche', '🔎', 'Suchen'], ['auftrag-neu', '➕', 'Auftrag'], ['meine-auftraege', '📋', 'Meine'], ['profil', '👤', 'Profil']];
  document.getElementById('tabbar').innerHTML = tabs
    .map(([r, i, l]) => `<a href="#/${r}" class="${r === current ? 'active' : ''}"><span class="ico">${i}</span>${l}</a>`)
    .join('');
}

/* ---------- Views ---------- */
function home() {
  if (state.role === 'handwerker') {
    const me = craftsman(state.myCraftsmanId);
    const open = state.jobs.filter((j) => j.status === 'offen' && me.trades.includes(j.trade) && sameRegion(j.plz, me.plz));
    return `
      <section class="hero">
        <h1>Hallo ${esc(me.name)}</h1>
        <p>${open.length} passende${open.length === 1 ? 'r' : ''} Auftrag${open.length === 1 ? '' : 'e'} in deiner Region warten auf ein Angebot.</p>
        <a class="btn" href="#/auftraege">Aufträge ansehen</a>
      </section>
      ${open.slice(0, 3).map(jobCard).join('') || '<div class="card empty">Aktuell keine offenen Aufträge.</div>'}`;
  }
  return `
    <section class="hero">
      <h1>Den richtigen Handwerker finden</h1>
      <p>Auftrag beschreiben, Angebote aus deiner Region erhalten, den besten Betrieb auswählen.</p>
      <form class="search" id="heroSearch">
        <select name="gewerk" aria-label="Gewerk">
          <option value="">Alle Gewerke</option>
          ${TRADES.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        <input name="plz" inputmode="numeric" maxlength="5" placeholder="PLZ" aria-label="Postleitzahl" value="${esc(state.me.plz)}">
        <button class="btn" type="submit">Suchen</button>
      </form>
    </section>
    <div class="row" style="margin-bottom:8px"><h2>Beliebte Gewerke</h2></div>
    <div class="grid">
      ${TRADES.map((t) => `<a class="card trade" href="#/suche?gewerk=${t.id}&plz=${esc(state.me.plz)}"><span class="emoji">${t.emoji}</span><strong>${t.name}</strong></a>`).join('')}
    </div>
    <div class="card" style="margin-top:12px">
      <h3>So funktioniert's</h3>
      <p class="muted">1. Auftrag kostenlos erstellen · 2. Angebote von Handwerkern erhalten · 3. Vergleichen und beauftragen</p>
      <a class="btn" href="#/auftrag-neu">Auftrag erstellen</a>
    </div>`;
}

function search(_, q) {
  const gewerk = q.get('gewerk') || '';
  const plz = q.get('plz') || '';
  const list = state.craftsmen
    .filter((c) => !gewerk || c.trades.includes(gewerk))
    .filter((c) => sameRegion(c.plz, plz))
    .sort((a, b) => b.rating - a.rating);
  return `
    <h1>Handwerker finden</h1>
    <form class="card two" id="searchForm">
      <div><label for="sg">Gewerk</label>
        <select id="sg" name="gewerk"><option value="">Alle Gewerke</option>
          ${TRADES.map((t) => `<option value="${t.id}" ${t.id === gewerk ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select></div>
      <div><label for="sp">PLZ</label><input id="sp" name="plz" inputmode="numeric" maxlength="5" value="${esc(plz)}" placeholder="z. B. 80331"></div>
    </form>
    <p class="muted">${list.length} Betrieb${list.length === 1 ? '' : 'e'} gefunden${plz ? ` im PLZ-Gebiet ${esc(plz.slice(0, 2))}xxx` : ''}</p>
    ${list.map(craftsmanCard).join('') || `<div class="card empty">Keine Handwerker gefunden.<br><br><a class="btn" href="#/auftrag-neu?gewerk=${esc(gewerk)}">Trotzdem Auftrag erstellen</a></div>`}`;
}

function craftsmanCard(c) {
  return `
    <a class="card" href="#/handwerker/${c.id}" style="display:block;text-decoration:none;color:inherit">
      <div class="row"><h3 style="margin:0">${esc(c.name)}</h3><span><span class="stars">${stars(c.rating)}</span> <span class="muted">${c.rating.toFixed(1)} (${c.reviews})</span></span></div>
      <p class="muted" style="margin:4px 0 8px">📍 ${esc(c.plz)} ${esc(c.city)}</p>
      ${c.trades.map((t) => `<span class="tag">${tradeById(t).emoji} ${tradeById(t).name}</span>`).join(' ')}
    </a>`;
}

function craftsmanDetail([id]) {
  const c = craftsman(id);
  if (!c) return notFound();
  return `
    <a href="javascript:history.back()" class="muted">← Zurück</a>
    <div class="card" style="margin-top:8px">
      <h1>${esc(c.name)}</h1>
      <p><span class="stars">${stars(c.rating)}</span> ${c.rating.toFixed(1)} · ${c.reviews} Bewertungen</p>
      <p class="muted">📍 ${esc(c.plz)} ${esc(c.city)} · ☎️ ${esc(c.phone)}</p>
      <p>${c.trades.map((t) => `<span class="tag">${tradeById(t).emoji} ${tradeById(t).name}</span>`).join(' ')}</p>
      <p>${esc(c.about)}</p>
      <a class="btn block" href="#/auftrag-neu?gewerk=${c.trades[0]}&handwerker=${c.id}">Angebot anfragen</a>
    </div>`;
}

function newJob(_, q) {
  const target = craftsman(q.get('handwerker'));
  const g = q.get('gewerk') || '';
  return `
    <h1>Auftrag erstellen</h1>
    ${target ? `<p class="muted">Anfrage geht direkt an <strong>${esc(target.name)}</strong> und an weitere passende Betriebe.</p>` : '<p class="muted">Beschreibe dein Vorhaben – passende Handwerker aus deiner Region senden dir Angebote.</p>'}
    <form class="card" id="jobForm">
      <label for="jt">Was soll gemacht werden?</label>
      <input id="jt" name="title" required maxlength="80" placeholder="z. B. Bad neu fliesen">
      <div class="two">
        <div><label for="jg">Gewerk</label>
          <select id="jg" name="trade" required>
            <option value="">Bitte wählen</option>
            ${TRADES.map((t) => `<option value="${t.id}" ${t.id === g ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select></div>
        <div><label for="jp">PLZ des Einsatzorts</label><input id="jp" name="plz" required inputmode="numeric" pattern="\\d{5}" maxlength="5" value="${esc(state.me.plz)}"></div>
      </div>
      <label for="jd">Beschreibung</label>
      <textarea id="jd" name="description" required placeholder="Größe, Material, Zustand, Besonderheiten …"></textarea>
      <div class="two">
        <div><label for="jw">Zeitraum</label>
          <select id="jw" name="when"><option>So schnell wie möglich</option><option>In den nächsten 2 Wochen</option><option>Innerhalb von 3 Monaten</option><option>Flexibel</option></select></div>
        <div><label for="jb">Budget (optional)</label><input id="jb" name="budget" placeholder="z. B. bis 2.000 €"></div>
      </div>
      <input type="hidden" name="direct" value="${target ? esc(target.id) : ''}">
      <button class="btn block" type="submit">Auftrag veröffentlichen</button>
    </form>`;
}

function jobCard(j) {
  const t = tradeById(j.trade);
  const n = j.offers.length;
  return `
    <a class="card" href="#/auftrag/${j.id}" style="display:block;text-decoration:none;color:inherit">
      <div class="row"><h3 style="margin:0">${esc(j.title)}</h3>
        <span class="tag ${j.status === 'vergeben' ? 'ok' : ''}">${j.status === 'vergeben' ? 'Vergeben' : n ? `${n} Angebot${n === 1 ? '' : 'e'}` : 'Offen'}</span></div>
      <p class="muted" style="margin:4px 0 0">${t.emoji} ${t.name} · 📍 ${esc(j.plz)} · ${fmtDate(j.created)}</p>
    </a>`;
}

function myJobs() {
  const mine = state.jobs.filter((j) => j.owner === 'me').sort((a, b) => b.created - a.created);
  return `
    <div class="row"><h1>Meine Aufträge</h1><a class="btn small" href="#/auftrag-neu">+ Neu</a></div>
    ${mine.map(jobCard).join('') || '<div class="card empty">Du hast noch keine Aufträge erstellt.<br><br><a class="btn" href="#/auftrag-neu">Ersten Auftrag erstellen</a></div>'}`;
}

function openJobs() {
  const me = craftsman(state.myCraftsmanId);
  const list = state.jobs
    .filter((j) => j.status === 'offen' && me.trades.includes(j.trade) && sameRegion(j.plz, me.plz))
    .sort((a, b) => b.created - a.created);
  return `
    <h1>Aufträge in deiner Region</h1>
    <p class="muted">Passend zu: ${me.trades.map((t) => tradeById(t).name).join(', ')} · PLZ-Gebiet ${esc(me.plz.slice(0, 2))}xxx</p>
    ${list.map(jobCard).join('') || '<div class="card empty">Aktuell keine passenden Aufträge.</div>'}`;
}

function jobDetail([id]) {
  const j = job(id);
  if (!j) return notFound();
  const t = tradeById(j.trade);
  const isPro = state.role === 'handwerker';
  const myOffer = j.offers.find((o) => o.craftsmanId === state.myCraftsmanId);

  let offersHtml = '';
  if (!isPro && j.owner === 'me') {
    offersHtml = `
      <div class="card"><h2>Angebote (${j.offers.length})</h2>
        ${j.offers.length ? j.offers.map((o) => {
          const c = craftsman(o.craftsmanId);
          const accepted = j.acceptedOffer === o.id;
          return `<div class="offer">
            <div class="row"><strong><a href="#/handwerker/${c.id}">${esc(c.name)}</a></strong><strong>${euro(o.price)}</strong></div>
            <p class="muted" style="margin:2px 0 6px"><span class="stars">${stars(c.rating)}</span> ${c.rating.toFixed(1)} · ${esc(o.date)}</p>
            <p>${esc(o.message)}</p>
            ${accepted ? '<span class="tag ok">✓ Beauftragt</span>' : j.status === 'offen' ? `<button class="btn small" data-accept="${o.id}">Angebot annehmen</button>` : ''}
          </div>`;
        }).join('') : '<p class="muted">Noch keine Angebote. Du wirst benachrichtigt, sobald Handwerker antworten.</p><p class="muted"><em>Demo-Tipp:</em> Oben rechts in den Handwerker-Modus wechseln und selbst ein Angebot abgeben.</p>'}
      </div>`;
  }

  let proHtml = '';
  if (isPro) {
    proHtml = myOffer
      ? `<div class="card"><h2>Dein Angebot</h2><p><strong>${euro(myOffer.price)}</strong> · ${esc(myOffer.date)}</p><p>${esc(myOffer.message)}</p>
         ${j.acceptedOffer === myOffer.id ? '<span class="tag ok">✓ Du wurdest beauftragt</span>' : '<span class="tag">Wartet auf Rückmeldung</span>'}</div>`
      : j.status === 'offen'
        ? `<form class="card" id="offerForm"><h2>Angebot abgeben</h2>
            <div class="two">
              <div><label for="op">Preis (brutto, €)</label><input id="op" name="price" type="number" min="1" step="1" required></div>
              <div><label for="od">Frühester Termin</label><input id="od" name="date" type="date" required></div>
            </div>
            <label for="om">Nachricht an den Kunden</label>
            <textarea id="om" name="message" required placeholder="Leistungsumfang, Material, Rückfragen …"></textarea>
            <button class="btn block" type="submit">Angebot senden</button></form>`
        : '<div class="card empty">Dieser Auftrag wurde bereits vergeben.</div>';
  }

  return `
    <a href="javascript:history.back()" class="muted">← Zurück</a>
    <div class="card" style="margin-top:8px">
      <div class="row"><h1 style="margin:0">${esc(j.title)}</h1><span class="tag ${j.status === 'vergeben' ? 'ok' : ''}">${j.status === 'vergeben' ? 'Vergeben' : 'Offen'}</span></div>
      <p class="muted" style="margin-top:6px">${t.emoji} ${t.name} · 📍 ${esc(j.plz)} · erstellt am ${fmtDate(j.created)}</p>
      <p style="white-space:pre-line">${esc(j.description)}</p>
      <p class="muted">🗓 ${esc(j.when)}${j.budget ? ` · 💶 ${esc(j.budget)}` : ''}</p>
    </div>
    ${offersHtml}${proHtml}`;
}

function profile() {
  if (state.role === 'handwerker') {
    const c = craftsman(state.myCraftsmanId);
    return `
      <h1>Mein Betrieb</h1>
      <form class="card" id="proForm">
        <label for="pn">Firmenname</label><input id="pn" name="name" value="${esc(c.name)}" required>
        <div class="two">
          <div><label for="pp">PLZ</label><input id="pp" name="plz" value="${esc(c.plz)}" inputmode="numeric" pattern="\\d{5}" maxlength="5" required></div>
          <div><label for="pc">Ort</label><input id="pc" name="city" value="${esc(c.city)}" required></div>
        </div>
        <label>Gewerke</label>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px">
          ${TRADES.map((t) => `<label style="font-weight:400;margin:0;display:flex;gap:8px;align-items:center"><input type="checkbox" name="trades" value="${t.id}" style="width:auto" ${c.trades.includes(t.id) ? 'checked' : ''}> ${t.name}</label>`).join('')}
        </div>
        <label for="pa">Über uns</label><textarea id="pa" name="about">${esc(c.about)}</textarea>
        <button class="btn block" type="submit">Speichern</button>
      </form>
      ${resetCard()}`;
  }
  return `
    <h1>Mein Profil</h1>
    <form class="card" id="meForm">
      <label for="mn">Name</label><input id="mn" name="name" value="${esc(state.me.name)}" required>
      <label for="me">E-Mail</label><input id="me" name="email" type="email" value="${esc(state.me.email)}">
      <label for="mp">PLZ</label><input id="mp" name="plz" value="${esc(state.me.plz)}" inputmode="numeric" pattern="\\d{5}" maxlength="5">
      <button class="btn block" type="submit">Speichern</button>
    </form>
    <div class="card"><h3>Bist du Handwerker?</h3><p class="muted">Erhalte Aufträge aus deiner Region und sende Angebote direkt aus der App.</p>
      <button class="btn secondary" data-role="handwerker">Zum Handwerker-Modus wechseln</button></div>
    ${resetCard()}`;
}

const resetCard = () => `<div class="card"><h3>Demo-Daten</h3><p class="muted">Alle Daten werden aktuell nur auf diesem Gerät gespeichert.</p><button class="btn secondary" id="resetBtn">Demo zurücksetzen</button></div>`;
const notFound = () => '<div class="card empty"><h2>Seite nicht gefunden</h2><a class="btn" href="#/">Zur Startseite</a></div>';

/* ---------- Event-Bindings ---------- */
function formData(form) {
  const fd = new FormData(form);
  const o = Object.fromEntries(fd.entries());
  o._all = (k) => fd.getAll(k);
  return o;
}

function bind() {
  const $ = (s) => document.querySelector(s);

  $('#heroSearch')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    go(`#/suche?gewerk=${encodeURIComponent(d.gewerk)}&plz=${encodeURIComponent(d.plz)}`);
  });

  const sf = $('#searchForm');
  if (sf) {
    const upd = () => { const d = formData(sf); history.replaceState(null, '', `#/suche?gewerk=${encodeURIComponent(d.gewerk)}&plz=${encodeURIComponent(d.plz)}`); render(); };
    sf.gewerk.addEventListener('change', upd);
    sf.plz.addEventListener('change', upd);
    sf.addEventListener('submit', (e) => { e.preventDefault(); upd(); });
  }

  $('#jobForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    const j = { id: uid('j'), title: d.title.trim(), trade: d.trade, plz: d.plz, description: d.description.trim(), when: d.when, budget: d.budget.trim(), owner: 'me', direct: d.direct || null, created: Date.now(), status: 'offen', offers: [] };
    state.jobs.push(j);
    save();
    toast('Auftrag veröffentlicht ✓');
    go(`#/auftrag/${j.id}`);
  });

  $('#offerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const { parts } = parseHash();
    const j = job(parts[1]);
    const d = formData(e.target);
    j.offers.push({ id: uid('o'), craftsmanId: state.myCraftsmanId, price: Number(d.price), date: new Date(d.date).toLocaleDateString('de-DE'), message: d.message.trim(), created: Date.now() });
    save();
    toast('Angebot gesendet ✓');
    render();
  });

  document.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => {
    const { parts } = parseHash();
    const j = job(parts[1]);
    if (!confirm('Dieses Angebot verbindlich annehmen?')) return;
    j.acceptedOffer = b.dataset.accept;
    j.status = 'vergeben';
    save();
    toast('Handwerker beauftragt ✓');
    render();
  }));

  $('#meForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    state.me = { name: d.name.trim(), email: d.email.trim(), plz: d.plz.trim() };
    save(); toast('Gespeichert ✓');
  });

  $('#proForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    const trades = d._all('trades');
    if (!trades.length) { toast('Bitte mindestens ein Gewerk wählen'); return; }
    Object.assign(craftsman(state.myCraftsmanId), { name: d.name.trim(), plz: d.plz.trim(), city: d.city.trim(), about: d.about.trim(), trades });
    save(); toast('Gespeichert ✓');
  });

  document.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));

  $('#resetBtn')?.addEventListener('click', () => {
    if (!confirm('Alle Demo-Daten auf diesem Gerät zurücksetzen?')) return;
    state = structuredClone(SEED); save(); toast('Zurückgesetzt'); go('#/');
    render();
  });
}

function setRole(role) {
  state.role = role;
  save();
  toast(role === 'handwerker' ? 'Handwerker-Modus aktiv' : 'Kunden-Modus aktiv');
  const { parts } = parseHash();
  if (parts[0] === 'auftrag') render(); else go('#/');
  render();
}

document.getElementById('roleToggle').addEventListener('click', () => setRole(state.role === 'handwerker' ? 'kunde' : 'handwerker'));
window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
