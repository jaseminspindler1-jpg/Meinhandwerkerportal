/* Mein Handwerkerportal – Oberfläche (Single-Page-App mit Hash-Routing).
 * Datenzugriff über `api` (siehe api.js): Supabase-Backend oder Demo-Modus. */
'use strict';

const api = createApi();
const IS_DEMO = api.mode === 'demo';

/* ---------- Hilfsfunktionen ---------- */
const tradeById = (id) => TRADES.find((t) => t.id === id) || { name: id, icon: 'tool' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (v) => new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const euro = (n) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const enc = encodeURIComponent;
const session = () => api.session;
const profile = () => api.session?.profile;
const isPro = () => profile()?.role === 'handwerker';
const tradeTags = (ids) => ids.map((t) => `<span class="tag">${icon(tradeById(t).icon)}${esc(tradeById(t).name)}</span>`).join(' ');
const tradeOptions = (sel, placeholder) => `<option value="">${placeholder}</option>` +
  TRADES.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`).join('');
const meta = (items) => `<p class="meta">${items.filter(Boolean).map(([ic, html]) => `<span>${icon(ic)}${html}</span>`).join('')}</p>`;
const telHref = (n) => `tel:${esc(String(n).replace(/[^\d+]/g, ''))}`;
const backLink = () => `<a href="javascript:history.back()" class="back">${icon('back')}Zurück</a>`;
const STATUS = { offen: ['Offen', ''], vergeben: ['Vergeben', 'ok'], storniert: ['Storniert', 'muted-tag'] };
const statusTag = (s) => `<span class="tag ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || esc(s)}</span>`;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------- Routing ---------- */
function parseHash() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(query) };
}
const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

// [View-Funktion, Login nötig?]
const routes = {
  '': [home, false],
  suche: [search, false],
  handwerker: [craftsmanDetail, false],
  login: [login, false],
  registrieren: [register, false],
  'passwort-neu': [newPassword, true],
  'auftrag-neu': [newJob, true],
  'meine-auftraege': [myJobs, true],
  auftraege: [openJobs, true],
  angebote: [myOffers, true],
  auftrag: [jobDetail, true],
  profil: [profileView, true],
  impressum: [impressum, false],
  datenschutz: [datenschutz, false],
};

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const { parts, q } = parseHash();
  const name = parts[0] || '';
  const [view, needsLogin] = routes[name] || [notFound, false];
  renderChrome(name);
  if (needsLogin && !session()) {
    go(`#/login?next=${enc(location.hash)}`);
    return;
  }
  const main = document.getElementById('view');
  main.setAttribute('aria-busy', 'true');
  let html;
  try {
    html = await view(parts.slice(1), q);
  } catch (e) {
    console.error(e);
    html = `<div class="card empty"><h2>Das hat nicht geklappt</h2><p>${esc(e.message)}</p><button class="btn" onclick="render()">Erneut versuchen</button></div>`;
  }
  if (token !== renderToken) return; // inzwischen weiternavigiert
  main.innerHTML = (IS_DEMO ? demoBanner() : '') + html;
  main.removeAttribute('aria-busy');
  bind(parts, q);
  window.scrollTo(0, 0);
}

function renderChrome(current) {
  const btn = document.getElementById('topAction');
  if (IS_DEMO) {
    btn.innerHTML = isPro() ? `${icon('business')}Handwerker` : `${icon('user')}Kunde`;
    btn.title = 'Demo: Rolle wechseln';
    btn.onclick = () => { api.setRole(isPro() ? 'kunde' : 'handwerker'); toast(isPro() ? 'Handwerker-Ansicht' : 'Kunden-Ansicht'); go('#/'); };
  } else if (session()) {
    btn.innerHTML = icon(isPro() ? 'business' : 'user') + esc((profile().name || 'Profil').split(' ')[0]);
    btn.title = 'Mein Profil';
    btn.onclick = () => go('#/profil');
  } else {
    btn.innerHTML = `${icon('login')}Anmelden`;
    btn.title = '';
    btn.onclick = () => go('#/login');
  }
  let tabs;
  if (!session()) tabs = [['', 'home', 'Start'], ['suche', 'search', 'Suchen'], ['auftrag-neu', 'plus', 'Auftrag'], ['login', 'user', 'Anmelden']];
  else if (isPro()) tabs = [['', 'home', 'Start'], ['auftraege', 'list', 'Aufträge'], ['angebote', 'offers', 'Angebote'], ['profil', 'business', 'Betrieb']];
  else tabs = [['', 'home', 'Start'], ['suche', 'search', 'Suchen'], ['auftrag-neu', 'plus', 'Auftrag'], ['meine-auftraege', 'list', 'Meine'], ['profil', 'user', 'Profil']];
  document.getElementById('tabbar').innerHTML = tabs
    .map(([r, i, l]) => `<a href="#/${r}" class="${r === current ? 'active' : ''}">${icon(i)}${l}</a>`).join('');
}

const demoBanner = () => '<div class="demo-banner">Demo-Modus · Daten nur auf diesem Gerät · Rolle oben rechts wechseln</div>';

/* ---------- Seiten ---------- */
async function home() {
  if (session() && isPro()) {
    const p = profile();
    const incomplete = !p.trades?.length || !/^\d{5}$/.test(p.plz || '') || !p.name;
    const jobs = incomplete ? [] : await api.openJobsForMe();
    const fresh = jobs.filter((j) => !j.offerCount);
    return `
      <section class="hero">
        <h1>Hallo ${esc(p.name || 'und willkommen')}</h1>
        ${incomplete
          ? '<p>Vervollständige dein Betriebsprofil (Name, PLZ, Gewerke), damit du passende Aufträge erhältst und in der Suche erscheinst.</p><a class="btn" href="#/profil">Profil vervollständigen</a>'
          : `<p>${fresh.length} passende${fresh.length === 1 ? 'r' : ''} Auftrag${fresh.length === 1 ? '' : 'e'} in deiner Region ${fresh.length === 1 ? 'wartet' : 'warten'} auf ein Angebot.</p><a class="btn" href="#/auftraege">Aufträge ansehen</a>`}
      </section>
      ${fresh.slice(0, 3).map(jobCard).join('') || (incomplete ? '' : '<div class="card empty">Aktuell keine neuen Aufträge.</div>')}`;
  }
  const plz = profile()?.plz || '';
  return `
    <section class="hero">
      <p class="eyebrow">Handwerker aus deiner Region</p>
      <h1>Auftrag beschreiben. <span>Angebote bekommen.</span></h1>
      <p>Sag uns, was zu tun ist und wo. Betriebe aus der Umgebung schicken dir ihr Angebot – du entscheidest, wen du beauftragst.</p>
      <form class="search" id="heroSearch">
        <select name="gewerk" aria-label="Gewerk">${tradeOptions('', 'Alle Gewerke')}</select>
        <input name="plz" inputmode="numeric" maxlength="5" placeholder="PLZ" aria-label="Postleitzahl" value="${esc(plz)}">
        <button class="btn" type="submit">Suchen</button>
      </form>
    </section>
    <section class="section">
      <div class="section-head"><h2>Gewerke</h2><a href="#/suche?plz=${enc(plz)}">Alle Betriebe</a></div>
      <div class="trade-list">
        ${TRADES.map((t) => `<a class="trade-row" href="#/suche?gewerk=${t.id}&plz=${enc(plz)}"><span class="trade-ico">${icon(t.icon)}</span>${t.name}${icon('chevron', 'chev')}</a>`).join('')}
      </div>
    </section>
    <section class="section">
      <h2>So läuft's ab</h2>
      <ol class="steps">
        <li><strong>Auftrag beschreiben</strong><span>Was soll gemacht werden, wo und bis wann? Je genauer, desto besser passen die Angebote.</span></li>
        <li><strong>Angebote vergleichen</strong><span>Jeder Betrieb nennt Preis, frühesten Termin und schreibt dir ein paar Zeilen dazu.</span></li>
        <li><strong>Betrieb beauftragen</strong><span>Erst wenn du ein Angebot annimmst, bekommt der Betrieb deine Kontaktdaten.</span></li>
      </ol>
      <a class="btn" href="#/auftrag-neu">${icon('plus')}Auftrag erstellen</a>
    </section>
    ${!session() ? `<section class="section pro-band"><p class="eyebrow">Für Handwerksbetriebe</p><h2>Neue Aufträge aus deiner Gegend</h2><p>Lege dein Betriebsprofil an und sieh, was in deiner Region gesucht wird. Du entscheidest, wo du ein Angebot abgibst.</p><a class="btn" href="#/registrieren?rolle=handwerker">Betrieb registrieren</a></section>` : ''}
    ${legalLinks()}`;
}

async function search(_, q) {
  const gewerk = q.get('gewerk') || '';
  const plz = q.get('plz') || '';
  const list = await api.searchCraftsmen({ trade: gewerk, plz });
  return `
    <h1>Handwerker finden</h1>
    <form class="card two" id="searchForm">
      <div><label for="sg">Gewerk</label><select id="sg" name="gewerk">${tradeOptions(gewerk, 'Alle Gewerke')}</select></div>
      <div><label for="sp">PLZ</label><input id="sp" name="plz" inputmode="numeric" maxlength="5" value="${esc(plz)}" placeholder="z. B. 80331"></div>
    </form>
    <p class="muted">${list.length} Betrieb${list.length === 1 ? '' : 'e'} gefunden${plz.length >= 2 ? ` im PLZ-Gebiet ${esc(plz.slice(0, 2))}xxx` : ''}</p>
    ${list.map(craftsmanCard).join('') || `<div class="card empty">Noch keine passenden Handwerker registriert.<br>Erstelle einen Auftrag – neue Betriebe in deiner Region sehen ihn sofort.<br><br><a class="btn" href="#/auftrag-neu?gewerk=${enc(gewerk)}">Auftrag erstellen</a></div>`}`;
}

function craftsmanCard(c) {
  return `
    <a class="card link-card" href="#/handwerker/${enc(c.id)}">
      <h3>${esc(c.name)}</h3>
      ${meta([['pin', `${esc(c.plz)} ${esc(c.city)}`]])}
      <p style="margin:10px 0 0">${tradeTags(c.trades)}</p>
    </a>`;
}

async function craftsmanDetail([id]) {
  const c = await api.getCraftsman(id);
  if (!c) return notFound();
  return `
    ${backLink()}
    <div class="card" style="margin-top:8px">
      <h1>${esc(c.name)}</h1>
      ${meta([['pin', `${esc(c.plz)} ${esc(c.city)}`], c.phone && ['phone', `<a href="${telHref(c.phone)}">${esc(c.phone)}</a>`]])}
      <p>${tradeTags(c.trades)}</p>
      ${c.about ? `<p style="white-space:pre-line">${esc(c.about)}</p>` : ''}
      ${session()?.user.id === c.id ? '<p class="muted">Das ist dein öffentliches Profil.</p>' : `<a class="btn block" href="#/auftrag-neu?gewerk=${enc(c.trades[0] || '')}&handwerker=${enc(c.id)}">Angebot anfragen</a>`}
    </div>`;
}

/* ----- Anmeldung ----- */
function login(_, q) {
  if (IS_DEMO) return '<div class="card empty"><h2>Demo-Modus</h2><p>Im Demo-Modus ist keine Anmeldung nötig. Sobald Supabase eingerichtet ist (siehe README), erscheint hier der Login.</p><a class="btn" href="#/">Zur Startseite</a></div>';
  if (session()) { setTimeout(() => go(q.get('next') || '#/'), 0); return ''; }
  return `
    <h1>Anmelden</h1>
    <form class="card" id="loginForm">
      <label for="le">E-Mail</label><input id="le" name="email" type="email" autocomplete="email" required>
      <label for="lp">Passwort</label><input id="lp" name="password" type="password" autocomplete="current-password" required>
      <button class="btn block" type="submit">Anmelden</button>
      <button class="link-btn" type="button" id="forgotBtn">Passwort vergessen?</button>
    </form>
    <p class="center">Noch kein Konto? <a href="#/registrieren${q.get('next') ? `?next=${enc(q.get('next'))}` : ''}">Jetzt registrieren</a></p>`;
}

function register(_, q) {
  if (IS_DEMO) return login(_, q);
  const role = q.get('rolle') === 'handwerker' ? 'handwerker' : 'kunde';
  return `
    <h1>Konto erstellen</h1>
    <form class="card" id="registerForm">
      <fieldset class="choice">
        <legend>Ich bin …</legend>
        <label><input type="radio" name="role" value="kunde" ${role === 'kunde' ? 'checked' : ''}><span><strong>${icon('user')}Kunde</strong><small>Ich suche einen Handwerker</small></span></label>
        <label><input type="radio" name="role" value="handwerker" ${role === 'handwerker' ? 'checked' : ''}><span><strong>${icon('business')}Handwerker</strong><small>Ich biete meine Leistungen an</small></span></label>
      </fieldset>
      <label for="rn" id="rnLabel">${role === 'handwerker' ? 'Firmenname' : 'Name'}</label><input id="rn" name="name" required maxlength="120" autocomplete="name">
      <div class="two">
        <div><label for="re">E-Mail</label><input id="re" name="email" type="email" required autocomplete="email"></div>
        <div><label for="rp">PLZ</label><input id="rp" name="plz" inputmode="numeric" pattern="\\d{5}" maxlength="5" required></div>
      </div>
      <label for="rw">Passwort (mind. 8 Zeichen)</label><input id="rw" name="password" type="password" minlength="8" required autocomplete="new-password">
      <label class="check"><input type="checkbox" required><span>Ich habe die <a href="#/datenschutz" target="_blank">Datenschutzerklärung</a> gelesen und stimme ihr zu.</span></label>
      <button class="btn block" type="submit">Registrieren</button>
    </form>
    <p class="center">Schon registriert? <a href="#/login${q.get('next') ? `?next=${enc(q.get('next'))}` : ''}">Anmelden</a></p>`;
}

function newPassword() {
  return `
    <h1>Neues Passwort</h1>
    <form class="card" id="pwForm">
      <label for="np">Neues Passwort (mind. 8 Zeichen)</label>
      <input id="np" name="password" type="password" minlength="8" required autocomplete="new-password">
      <button class="btn block" type="submit">Passwort speichern</button>
    </form>`;
}

/* ----- Aufträge (Kunde) ----- */
async function newJob(_, q) {
  const target = q.get('handwerker') ? await api.getCraftsman(q.get('handwerker')) : null;
  if (isPro()) return '<div class="card empty"><h2>Nur für Kunden</h2><p>Mit einem Handwerker-Konto kannst du keine Aufträge erstellen.</p></div>';
  return `
    <h1>Auftrag erstellen</h1>
    ${target ? `<p class="muted">Anfrage geht direkt an <strong>${esc(target.name)}</strong> und an weitere passende Betriebe.</p>` : '<p class="muted">Beschreibe dein Vorhaben – passende Handwerker aus deiner Region senden dir Angebote.</p>'}
    <form class="card" id="jobForm">
      <label for="jt">Was soll gemacht werden?</label>
      <input id="jt" name="title" required minlength="3" maxlength="80" placeholder="z. B. Bad neu fliesen">
      <div class="two">
        <div><label for="jg">Gewerk</label><select id="jg" name="trade" required>${tradeOptions(q.get('gewerk') || '', 'Bitte wählen')}</select></div>
        <div><label for="jp">PLZ des Einsatzorts</label><input id="jp" name="plz" required inputmode="numeric" pattern="\\d{5}" maxlength="5" value="${esc(profile()?.plz || '')}"></div>
      </div>
      <label for="jd">Beschreibung</label>
      <textarea id="jd" name="description" required minlength="5" maxlength="5000" placeholder="Größe, Material, Zustand, Besonderheiten …"></textarea>
      <div class="two">
        <div><label for="jw">Zeitraum</label>
          <select id="jw" name="when"><option>So schnell wie möglich</option><option>In den nächsten 2 Wochen</option><option>Innerhalb von 3 Monaten</option><option>Flexibel</option></select></div>
        <div><label for="jb">Budget (optional)</label><input id="jb" name="budget" maxlength="80" placeholder="z. B. bis 2.000 €"></div>
      </div>
      <input type="hidden" name="directId" value="${target ? esc(target.id) : ''}">
      <p class="muted small">Deine Kontaktdaten sieht nur der Handwerker, den du beauftragst.</p>
      <button class="btn block" type="submit">Auftrag veröffentlichen</button>
    </form>`;
}

function jobCard(j) {
  const t = tradeById(j.trade);
  let badge;
  if (j.status !== 'offen') badge = statusTag(j.status);
  else if (isPro()) badge = j.offerCount ? '<span class="tag ok">Angebot gesendet</span>' : j.directId === session()?.user.id ? '<span class="tag">Direktanfrage</span>' : '<span class="tag">Neu</span>';
  else badge = `<span class="tag">${j.offerCount ? `${j.offerCount} Angebot${j.offerCount === 1 ? '' : 'e'}` : 'Offen'}</span>`;
  return `
    <a class="card link-card" href="#/auftrag/${enc(j.id)}">
      <div class="row"><h3>${esc(j.title)}</h3>${badge}</div>
      ${meta([[t.icon, esc(t.name)], ['pin', esc(j.plz)], ['clock', fmtDate(j.created)]])}
    </a>`;
}

async function myJobs() {
  if (isPro()) { setTimeout(() => go('#/auftraege'), 0); return ''; }
  const mine = await api.myJobs();
  return `
    <div class="row"><h1>Meine Aufträge</h1><a class="btn small" href="#/auftrag-neu">+ Neu</a></div>
    ${mine.map(jobCard).join('') || '<div class="card empty">Du hast noch keine Aufträge erstellt.<br><br><a class="btn" href="#/auftrag-neu">Ersten Auftrag erstellen</a></div>'}`;
}

/* ----- Aufträge (Handwerker) ----- */
async function openJobs() {
  if (!isPro()) { setTimeout(() => go('#/meine-auftraege'), 0); return ''; }
  const p = profile();
  const list = await api.openJobsForMe();
  return `
    <h1>Aufträge in deiner Region</h1>
    <p class="muted">${p.trades?.length ? `Passend zu: ${p.trades.map((t) => esc(tradeById(t).name)).join(', ')}` : 'Keine Gewerke hinterlegt'}${p.plz ? ` · PLZ-Gebiet ${esc(p.plz.slice(0, 2))}xxx` : ''} · <a href="#/profil">ändern</a></p>
    ${list.map(jobCard).join('') || '<div class="card empty">Aktuell keine passenden Aufträge. Neue Aufträge erscheinen hier automatisch.</div>'}`;
}

async function myOffers() {
  const list = await api.myOffers();
  return `
    <h1>Meine Angebote</h1>
    ${list.map((o) => {
      const won = o.job?.acceptedOffer === o.id;
      const tag = won ? '<span class="tag ok">✓ Beauftragt</span>' : o.job?.status === 'offen' ? '<span class="tag">Wartet</span>' : '<span class="tag muted-tag">Nicht gewählt</span>';
      return `<a class="card link-card" href="#/auftrag/${enc(o.jobId)}">
        <div class="row"><h3>${esc(o.job?.title || 'Auftrag')}</h3>${tag}</div>
        <p class="muted" style="margin:4px 0 0">${euro(o.price)} · ab ${fmtDate(o.date)} · gesendet am ${fmtDate(o.created)}</p></a>`;
    }).join('') || '<div class="card empty">Du hast noch keine Angebote abgegeben.<br><br><a class="btn" href="#/auftraege">Aufträge ansehen</a></div>'}`;
}

/* ----- Auftragsdetail ----- */
async function jobDetail([id]) {
  const j = await api.getJob(id);
  if (!j) return notFound();
  const t = tradeById(j.trade);
  const uid = session().user.id;
  const isOwner = j.ownerId === uid;
  const myOffer = j.offers.find((o) => o.craftsmanId === uid);
  let extra = '';

  if (isOwner) {
    extra = `
      <div class="card"><h2>Angebote (${j.offers.length})</h2>
        ${j.offers.length ? j.offers.map((o) => {
          const c = o.craftsman || { name: 'Handwerker', phone: '' };
          const accepted = j.acceptedOffer === o.id;
          return `<div class="offer">
            <div class="row"><strong><a href="#/handwerker/${enc(o.craftsmanId)}">${esc(c.name)}</a></strong><span class="price">${euro(o.price)}</span></div>
            ${meta([['calendar', `ab ${fmtDate(o.date)}`], c.city && ['pin', esc(c.city)]])}
            <p style="white-space:pre-line">${esc(o.message)}</p>
            ${accepted ? `<span class="tag ok">✓ Beauftragt</span>${c.phone ? ` <a class="btn small secondary" href="${telHref(c.phone)}">${icon('phone')}${esc(c.phone)}</a>` : ''}`
              : j.status === 'offen' ? `<button class="btn small" data-accept="${esc(o.id)}">Angebot annehmen</button>` : ''}
          </div>`;
        }).join('') : `<p class="muted">Noch keine Angebote. Passende Handwerker aus deiner Region sehen deinen Auftrag jetzt.</p>${IS_DEMO ? '<p class="muted"><em>Demo-Tipp:</em> Oben rechts in die Handwerker-Ansicht wechseln und selbst ein Angebot abgeben.</p>' : ''}`}
      </div>
      ${j.status === 'offen' ? '<button class="btn secondary block" id="cancelJob">Auftrag zurückziehen</button>' : ''}`;
  } else if (isPro()) {
    if (myOffer) {
      const won = j.acceptedOffer === myOffer.id;
      extra = `<div class="card"><h2>Dein Angebot</h2>
        <p><strong>${euro(myOffer.price)}</strong> · frühester Termin ${fmtDate(myOffer.date)}</p>
        <p style="white-space:pre-line">${esc(myOffer.message)}</p>
        ${won ? '<span class="tag ok">✓ Du wurdest beauftragt</span>' : j.status === 'offen' ? `<span class="tag">Wartet auf Rückmeldung</span> <button class="link-btn" data-withdraw="${esc(myOffer.id)}">Angebot zurückziehen</button>` : '<span class="tag muted-tag">Ein anderer Betrieb wurde beauftragt</span>'}
      </div>
      ${won && j.client ? `<div class="card"><h2>Kontakt zum Kunden</h2>
        <p><strong>${esc(j.client.name || 'Kunde')}</strong></p>
        ${j.client.email ? `<p class="contact">${icon('mail')}<a href="mailto:${esc(j.client.email)}">${esc(j.client.email)}</a></p>` : ''}
        ${j.client.phone ? `<p class="contact">${icon('phone')}<a href="${telHref(j.client.phone)}">${esc(j.client.phone)}</a></p>` : ''}
      </div>` : ''}`;
    } else if (j.status === 'offen') {
      const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      extra = `<form class="card" id="offerForm"><h2>Angebot abgeben</h2>
        <div class="two">
          <div><label for="op">Preis (brutto, €)</label><input id="op" name="price" type="number" min="1" step="0.01" required></div>
          <div><label for="od">Frühester Termin</label><input id="od" name="date" type="date" min="${tomorrow}" required></div>
        </div>
        <label for="om">Nachricht an den Kunden</label>
        <textarea id="om" name="message" required maxlength="3000" placeholder="Leistungsumfang, Material, Rückfragen …"></textarea>
        <button class="btn block" type="submit">Angebot senden</button></form>`;
    } else {
      extra = '<div class="card empty">Dieser Auftrag ist nicht mehr offen.</div>';
    }
  }

  return `
    ${backLink()}
    <div class="card" style="margin-top:8px">
      <div class="row"><h1 style="margin:0">${esc(j.title)}</h1>${statusTag(j.status)}</div>
      ${meta([[t.icon, esc(t.name)], ['pin', esc(j.plz)], ['clock', `erstellt am ${fmtDate(j.created)}`]])}
      <p style="white-space:pre-line">${esc(j.description)}</p>
      ${meta([['calendar', esc(j.when)], j.budget && ['euro', esc(j.budget)]])}
    </div>
    ${extra}`;
}

/* ----- Profil ----- */
function profileView() {
  const p = profile();
  const pro = isPro();
  return `
    <h1>${pro ? 'Mein Betrieb' : 'Mein Profil'}</h1>
    <form class="card" id="profileForm">
      <label for="pn">${pro ? 'Firmenname' : 'Name'}</label><input id="pn" name="name" value="${esc(p.name)}" required maxlength="120">
      ${!IS_DEMO ? `<label>E-Mail</label><input value="${esc(session().user.email)}" disabled>` : ''}
      <div class="two">
        <div><label for="pp">PLZ</label><input id="pp" name="plz" value="${esc(p.plz || '')}" inputmode="numeric" pattern="\\d{5}" maxlength="5" ${pro ? 'required' : ''}></div>
        <div><label for="pc">Ort</label><input id="pc" name="city" value="${esc(p.city || '')}" maxlength="80" ${pro ? 'required' : ''}></div>
      </div>
      <label for="pt">Telefon ${pro ? '(öffentlich sichtbar)' : '(nur für beauftragte Handwerker)'}</label>
      <input id="pt" name="phone" type="tel" value="${esc(p.phone || '')}" maxlength="40">
      ${pro ? `
        <label>Gewerke</label>
        <div class="checks">${TRADES.map((t) => `<label class="check"><input type="checkbox" name="trades" value="${t.id}" ${p.trades?.includes(t.id) ? 'checked' : ''}> ${t.name}</label>`).join('')}</div>
        <label for="pa">Über uns</label><textarea id="pa" name="about" maxlength="2000">${esc(p.about || '')}</textarea>` : ''}
      <button class="btn block" type="submit">Speichern</button>
    </form>
    ${pro ? `<a class="btn secondary block" href="#/handwerker/${enc(session().user.id)}">Öffentliches Profil ansehen</a>` : ''}
    ${IS_DEMO
      ? '<div class="card" style="margin-top:12px"><h3>Demo-Daten</h3><p class="muted">Alle Daten liegen nur auf diesem Gerät.</p><button class="btn secondary" id="resetBtn">Demo zurücksetzen</button></div>'
      : '<button class="btn secondary block" id="logoutBtn" style="margin-top:12px">Abmelden</button>'}
    ${legalLinks()}`;
}

/* ----- Rechtliches (Platzhalter – vor dem Start ausfüllen!) ----- */
const legalLinks = () => '<p class="center small muted" style="margin-top:20px"><a href="#/impressum">Impressum</a> · <a href="#/datenschutz">Datenschutz</a></p>';
function impressum() { return `<div class="card"><h1>Impressum</h1><p class="muted">Angaben gemäß § 5 DDG</p>
  <p><strong>[Name / Firma]</strong><br>[Straße Hausnummer]<br>[PLZ Ort]</p>
  <p>E-Mail: [kontakt@meinhandwerkerportal.com]<br>Telefon: [Telefonnummer]</p>
  <p class="muted small">Platzhalter – bitte vor dem Livegang mit den echten Angaben ersetzen.</p></div>`; }
function datenschutz() { return `<div class="card"><h1>Datenschutzerklärung</h1>
  <p>Verantwortlich: siehe <a href="#/impressum">Impressum</a>.</p>
  <h3>Welche Daten wir verarbeiten</h3>
  <p>Konto (E-Mail, Name, PLZ, optional Telefon), Aufträge und Angebote, die du einstellst. Kontaktdaten von Kunden sind nur für den beauftragten Handwerker sichtbar. Profile von Handwerkern sind öffentlich.</p>
  <h3>Hosting</h3>
  <p>Datenbank und Anmeldung: Supabase (Serverstandort EU/Frankfurt). Webseite: GitHub Pages.</p>
  <h3>Deine Rechte</h3>
  <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch – formlos per E-Mail an die im Impressum genannte Adresse.</p>
  <p class="muted small">Platzhalter – bitte vor dem Livegang rechtlich prüfen lassen bzw. mit einem Generator erstellen.</p></div>`; }
const notFound = () => '<div class="card empty"><h2>Seite nicht gefunden</h2><a class="btn" href="#/">Zur Startseite</a></div>';

/* ---------- Formulare & Buttons ---------- */
function formData(form) {
  const fd = new FormData(form);
  const o = {};
  for (const [k, v] of fd.entries()) o[k] = typeof v === 'string' ? v.trim() : v;
  o.$all = (k) => fd.getAll(k);
  return o;
}

// Formular absenden mit Ladezustand und Fehlermeldung
function onSubmit(sel, handler) {
  const form = document.querySelector(sel);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try { await handler(formData(form), form); } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
}
async function action(fn) { try { await fn(); } catch (err) { toast(err.message); } }

function bind(parts, q) {
  const $ = (s) => document.querySelector(s);
  const jobId = parts[1];

  onSubmit('#heroSearch', (d) => go(`#/suche?gewerk=${enc(d.gewerk)}&plz=${enc(d.plz)}`));

  const sf = $('#searchForm');
  if (sf) {
    const upd = () => { const d = formData(sf); go(`#/suche?gewerk=${enc(d.gewerk)}&plz=${enc(d.plz)}`); };
    sf.gewerk.addEventListener('change', upd);
    sf.plz.addEventListener('change', upd);
    sf.addEventListener('submit', (e) => { e.preventDefault(); upd(); });
  }

  onSubmit('#loginForm', async (d) => {
    await api.signIn(d);
    toast('Willkommen zurück!');
    go(q.get('next') || '#/');
  });
  $('#forgotBtn')?.addEventListener('click', () => action(async () => {
    const email = $('#le').value.trim();
    if (!email) { toast('Bitte zuerst deine E-Mail-Adresse eintragen.'); $('#le').focus(); return; }
    await api.resetPassword(email);
    toast('Falls ein Konto existiert, haben wir dir einen Link geschickt.');
  }));

  const rf = $('#registerForm');
  rf?.querySelectorAll('input[name=role]').forEach((r) => r.addEventListener('change', () => {
    $('#rnLabel').textContent = rf.role.value === 'handwerker' ? 'Firmenname' : 'Name';
  }));
  onSubmit('#registerForm', async (d) => {
    const { needsConfirmation } = await api.signUp(d);
    if (needsConfirmation) {
      document.getElementById('view').innerHTML = `<div class="card empty"><h2>Fast geschafft</h2>
        <p>Wir haben eine Bestätigungsmail an <strong>${esc(d.email)}</strong> geschickt.<br>Klicke auf den Link darin, um dein Konto zu aktivieren.</p></div>`;
      return;
    }
    toast('Konto erstellt ✓');
    go(d.role === 'handwerker' ? '#/profil' : (q.get('next') || '#/'));
  });

  onSubmit('#pwForm', async (d) => {
    await api.updatePassword(d.password);
    toast('Passwort geändert ✓');
    go('#/');
  });

  onSubmit('#jobForm', async (d) => {
    const job = await api.createJob(d);
    toast('Auftrag veröffentlicht ✓');
    go(`#/auftrag/${job.id}`);
  });

  onSubmit('#offerForm', async (d) => {
    await api.createOffer(jobId, { price: Number(d.price), date: d.date, message: d.message });
    toast('Angebot gesendet ✓');
    render();
  });

  document.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => action(async () => {
    if (!confirm('Dieses Angebot verbindlich annehmen? Der Handwerker erhält dann deine Kontaktdaten.')) return;
    await api.acceptOffer(jobId, b.dataset.accept);
    toast('Handwerker beauftragt ✓');
    render();
  })));

  document.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => action(async () => {
    if (!confirm('Angebot wirklich zurückziehen?')) return;
    await api.withdrawOffer(b.dataset.withdraw);
    toast('Angebot zurückgezogen');
    render();
  })));

  $('#cancelJob')?.addEventListener('click', () => action(async () => {
    if (!confirm('Auftrag zurückziehen? Handwerker können dann keine Angebote mehr abgeben.')) return;
    await api.cancelJob(jobId);
    toast('Auftrag zurückgezogen');
    render();
  }));

  onSubmit('#profileForm', async (d) => {
    const fields = { name: d.name, plz: d.plz, city: d.city, phone: d.phone };
    if (isPro()) {
      fields.trades = d.$all('trades');
      fields.about = d.about;
      if (!fields.trades.length) throw new Error('Bitte mindestens ein Gewerk wählen.');
    }
    await api.updateProfile(fields);
    toast('Gespeichert ✓');
    renderChrome(parts[0]);
  });

  $('#logoutBtn')?.addEventListener('click', () => action(async () => {
    await api.signOut();
    toast('Abgemeldet');
    go('#/');
  }));

  $('#resetBtn')?.addEventListener('click', () => {
    if (!confirm('Alle Demo-Daten auf diesem Gerät zurücksetzen?')) return;
    api.reset(); toast('Zurückgesetzt'); go('#/');
  });
}

/* ---------- Start ---------- */
/* ---------- Wartungsmodus ---------- */
/* Zugang während der Wartung:
 * - Ist in config.js ein maintenancePasswordHash gesetzt, entsperrt nur das Passwort die App.
 *   Gespeichert wird nur ein PBKDF2-Hash (absichtlich langsam), nie das Passwort selbst.
 *   Wird das Passwort geändert, verfallen alle bisherigen Freischaltungen (Bindung an das Salt).
 * - Ohne Passwort-Hash genügt ?vorschau=an.
 * Hinweis: Das ist eine Zugangssperre im Browser, kein Serverschutz. Die Daten selbst schützt die
 * Datenbank (Row Level Security) unabhängig davon. */
const PREVIEW_KEY = 'mhp-vorschau';
const cfg = () => window.MHP_CONFIG || {};
const pwParts = () => {
  const [alg, it, salt, hash] = String(cfg().maintenancePasswordHash || '').split('$');
  return alg === 'pbkdf2' && it && salt && hash ? { it: Number(it), salt, hash } : null;
};
const previewToken = () => pwParts()?.salt || '1';
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
async function pbkdf2(password, saltB64, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
async function makePasswordHash(password) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const it = 310000;
  return `pbkdf2$${it}$${salt}$${await pbkdf2(password, salt, it)}`;
}
const previewStore = {
  get() { try { return localStorage.getItem(PREVIEW_KEY); } catch (_) { return null; } },
  put(v) { try { localStorage.setItem(PREVIEW_KEY, v); } catch (_) { /* ignore */ } },
  drop() { try { localStorage.removeItem(PREVIEW_KEY); } catch (_) { /* ignore */ } },
};

function maintenanceActive() {
  const flag = new URLSearchParams(location.search).get('vorschau');
  if (flag === 'aus') previewStore.drop();
  if (flag === 'an' && !pwParts()) previewStore.put('1');
  if (flag) history.replaceState(null, '', location.pathname + location.hash);
  if (!cfg().maintenance) return false;
  const unlocked = previewStore.get() === previewToken();
  if (unlocked) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="preview-bar">Vorschau – Besucher sehen gerade die Wartungsseite · <a href="?vorschau=aus">Vorschau beenden</a></div>');
  }
  return !unlocked;
}

function showMaintenance() {
  document.title = 'Wartungsarbeiten – Mein Handwerkerportal';
  document.body.classList.add('maintenance');
  document.getElementById('topAction').hidden = true;
  document.getElementById('tabbar').hidden = true;
  const generator = new URLSearchParams(location.search).has('passwort-erzeugen');
  document.getElementById('view').innerHTML = generator ? passwordGeneratorView() : `
    <section class="maint">
      <div class="maint-icon" aria-hidden="true">${icon('construction')}</div>
      <h1>Hier wird gerade gebaut</h1>
      <p>Auf <strong>meinhandwerkerportal.com</strong> werden im Moment Wartungsarbeiten durchgeführt.</p>
      <p>Bald findest du hier Handwerker aus deiner Region – Auftrag einstellen, Angebote vergleichen, Betrieb beauftragen.</p>
      <p class="muted">Danke für deine Geduld – schau gerne bald wieder vorbei!</p>
    </section>`;

  // Versteckter Team-Zugang: Tipp auf das Logo öffnet ein Fenster mit Passwortfeld.
  if (!generator) {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="unlockDialog" class="unlock-dialog" aria-labelledby="unlockTitle">
        <form id="unlockForm" class="unlock">
          <div class="row"><h2 id="unlockTitle">Team-Zugang</h2>
            <button class="icon-btn" type="button" id="unlockClose" aria-label="Schließen">${icon('x')}</button></div>
          ${pwParts() ? `
          <label for="up">Passwort</label>
          <input id="up" name="password" type="password" autocomplete="current-password" required>
          <button class="btn block" type="submit">Entsperren</button>`
          : '<p class="muted">Es ist noch kein Team-Passwort festgelegt.</p>'}
        </form>
      </dialog>`);
    const dlg = document.getElementById('unlockDialog');
    document.querySelector('.brand').addEventListener('click', (e) => {
      e.preventDefault();
      dlg.showModal();
      dlg.querySelector('input')?.focus();
    });
    document.getElementById('unlockClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // Tipp neben das Fenster
  }
  onSubmit('#unlockForm', async (d, form) => {
    const p = pwParts();
    const ok = (await pbkdf2(d.password, p.salt, p.it)) === p.hash;
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800));
      form.password.value = '';
      throw new Error('Das Passwort stimmt nicht.');
    }
    previewStore.put(p.salt);
    location.replace(location.pathname);
  });
  onSubmit('#genForm', async (d) => {
    if (d.password.length < 10) throw new Error('Bitte mindestens 10 Zeichen verwenden.');
    if (d.password !== d.repeat) throw new Error('Die beiden Eingaben stimmen nicht überein.');
    const out = document.getElementById('genOut');
    out.value = `maintenancePasswordHash: '${await makePasswordHash(d.password)}',`;
    document.getElementById('genResult').hidden = false;
    out.select();
  });
  document.getElementById('genCopy')?.addEventListener('click', async () => {
    const out = document.getElementById('genOut');
    try { await navigator.clipboard.writeText(out.value); toast('Kopiert ✓'); } catch (_) { out.select(); toast('Bitte den markierten Text kopieren'); }
  });
}

function passwordGeneratorView() {
  return `
    <section class="maint">
      <div class="maint-icon" aria-hidden="true">${icon('login')}</div>
      <h1>Team-Passwort festlegen</h1>
      <p>Das Passwort wird nur hier auf deinem Gerät verarbeitet und nirgends hingeschickt. Heraus kommt eine Zeile für <code>config.js</code>.</p>
      <form id="genForm" class="unlock" style="max-width:none">
        <label for="gp">Neues Passwort (mind. 10 Zeichen)</label>
        <input id="gp" name="password" type="password" autocomplete="new-password" minlength="10" required>
        <label for="gr">Passwort wiederholen</label>
        <input id="gr" name="repeat" type="password" autocomplete="new-password" required>
        <button class="btn block" type="submit">Zeile erzeugen</button>
      </form>
      <div id="genResult" hidden style="width:100%;margin-top:18px">
        <label for="genOut">Diese Zeile in config.js eintragen (ersetzt die Zeile mit den leeren Anführungszeichen)</label>
        <textarea id="genOut" readonly rows="4" style="font-family:ui-monospace,monospace;font-size:.85rem"></textarea>
        <button class="btn secondary block" id="genCopy" type="button">Zeile kopieren</button>
      </div>
    </section>`;
}

(async function start() {
  const wantsGenerator = new URLSearchParams(location.search).has('passwort-erzeugen');
  if (maintenanceActive() || wantsGenerator) { showMaintenance(); return; }

  // Rücksprung aus Bestätigungs-/Passwort-Mails: Supabase hängt Tokens an die URL (#access_token=…)
  const authHash = new URLSearchParams(location.hash.startsWith('#/') ? '' : location.hash.slice(1));
  const authType = authHash.get('type');
  const authError = authHash.get('error_description');

  await api.init((event) => {
    if (event === 'PASSWORD_RECOVERY') go('#/passwort-neu');
    else if (event === 'SIGNED_OUT') render();
    else renderChrome(parseHash().parts[0] || ''); // z. B. Token-Erneuerung: Formulare nicht verwerfen
  });

  if (authHash.has('access_token') || authError) {
    history.replaceState(null, '', location.pathname + (authType === 'recovery' ? '#/passwort-neu' : '#/'));
    if (authError) toast(authError.replace(/\+/g, ' '));
    else if (authType === 'signup') toast('E-Mail bestätigt – willkommen! ✓');
  }

  window.addEventListener('hashchange', render);
  render();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
