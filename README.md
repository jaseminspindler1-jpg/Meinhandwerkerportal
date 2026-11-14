# Meinhandwerkerportal
Plattform zur Vermittlung von Handwerkern und Kunden. Kunden können Aufträge erstellen, Angebote erhalten und Handwerker in ihrer Region finden.

Domain: **meinhandwerkerportal.com**

## Die App
Progressive Web App (PWA): läuft im Browser unter der Domain und lässt sich auf Handy und PC
wie eine normale App installieren („Zum Startbildschirm hinzufügen“).

**Kunden**
- Handwerker nach Gewerk und PLZ suchen (auch ohne Anmeldung)
- Auftrag erstellen (optional als Direktanfrage an einen Betrieb), zurückziehen
- Angebote vergleichen und annehmen – erst dann sieht der Handwerker die Kontaktdaten

**Handwerker**
- Betriebsprofil mit Gewerken, Ort und Beschreibung (öffentlich in der Suche)
- Passende Aufträge aus der eigenen Region (gleiche ersten zwei PLZ-Ziffern) + Direktanfragen
- Angebote mit Preis, Termin und Nachricht senden, zurückziehen, Status verfolgen

### Backend: Supabase
- Registrierung/Login per E-Mail und Passwort (inkl. Bestätigungsmail und „Passwort vergessen“)
- Postgres-Datenbank mit **Row Level Security**: Jeder sieht nur, was er sehen darf
  (Regeln und Tests: `supabase/schema.sql`, `supabase/tests/`)
- Kein eigener Server nötig; die Webseite selbst bleibt statisch (GitHub Pages)

**Demo-Modus:** Solange in `config.js` keine Supabase-Zugangsdaten stehen, läuft die App ohne
Backend mit Beispieldaten, die nur im Browser gespeichert werden.

## Supabase einrichten (ca. 15 Minuten)
1. Auf [supabase.com](https://supabase.com) kostenlos registrieren → **New project**.
   Region **Central EU (Frankfurt)** wählen (DSGVO), Datenbank-Passwort sicher aufbewahren.
2. Im Projekt links **SQL Editor** → **New query** → kompletten Inhalt von
   [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://meinhandwerkerportal.com`
   - *Redirect URLs*: `https://meinhandwerkerportal.com/**` (und für Tests `http://localhost:8000/**`)
4. **Project Settings → API** (bzw. *API Keys*): `Project URL` und den `anon`/`publishable` Key
   in [`config.js`](config.js) eintragen. Dieser Key ist öffentlich – geschützt wird über die
   Regeln aus Schritt 2. Den `service_role`/`secret` Key **niemals** in den Code schreiben!
5. Empfohlen vor dem Start:
   - **Authentication → Emails → SMTP Settings**: eigenen Mailversand einrichten
     (der eingebaute Versand von Supabase schafft nur wenige Mails pro Stunde).
   - **Authentication → Emails → Templates**: Texte der Mails auf Deutsch übersetzen.

## Veröffentlichen auf meinhandwerkerportal.com (GitHub Pages)
1. Repository → *Settings* → *Pages* → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
2. Die Datei `CNAME` enthält bereits `meinhandwerkerportal.com`.
3. Beim Domain-Anbieter DNS-Einträge setzen:
   - `A`-Records für `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` für `www` → `jaseminspindler1-jpg.github.io`
4. In den Pages-Einstellungen „Enforce HTTPS“ aktivieren (nötig für Login und App-Installation).

## Wartungsmodus und Team-Zugang
Solange in `config.js` `maintenance: true` steht, sehen Besucher nur die Seite „Hier wird gerade gebaut“.

**Team-Passwort festlegen**
1. `https://meinhandwerkerportal.com/?passwort-erzeugen` öffnen, Passwort zweimal eingeben, **Zeile erzeugen**.
   Das Passwort verlässt dabei das Gerät nicht.
2. Die erzeugte Zeile kopieren. Sie beginnt mit `maintenancePasswordHash: 'pbkdf2$…`.
3. Auf GitHub `config.js` bearbeiten (Stift-Symbol) und die Zeile `maintenancePasswordHash: '',`
   durch die kopierte Zeile ersetzen, dann **Commit changes**.

**Entsperren:** Auf der Wartungsseite unten auf „Zugang fürs Team“ tippen und das Passwort eingeben.
Das gilt pro Gerät bzw. Browser, auch für die Homescreen-App. „Vorschau beenden“ in der orangefarbenen
Leiste sperrt wieder. Wird das Passwort geändert, verfallen alle bisherigen Freischaltungen.

**Start der Seite:** `maintenance: false` setzen.

> Das ist eine Zugangssperre im Browser, kein Serverschutz: Der Code der Seite ist öffentlich.
> Die Daten (Konten, Aufträge, Angebote) schützt unabhängig davon die Datenbank.
> Ohne Passwort-Hash funktioniert der Zugang über `?vorschau=an`.

## Vor dem Livegang
- [ ] `maintenance: false` in `config.js`
- [ ] **Impressum** und **Datenschutzerklärung** in `app.js` (Funktionen `impressum`/`datenschutz`)
      mit echten Angaben füllen bzw. rechtlich prüfen lassen
- [ ] Eigener SMTP-Mailversand in Supabase
- [ ] Mit Supabase einen Auftragsverarbeitungsvertrag (DPA) abschließen (im Dashboard verfügbar)

## Ideen für die nächsten Schritte
Bewertungen nach abgeschlossenem Auftrag · Fotos zum Auftrag (Supabase Storage) ·
E-Mail-/Push-Benachrichtigung bei neuem Angebot · Chat zwischen Kunde und Handwerker ·
Umkreissuche in km statt PLZ-Gebiet · Konto löschen per Klick

## Entwicklung
```bash
python3 -m http.server 8000          # App lokal starten: http://localhost:8000
./supabase/tests/run.sh              # Datenbank-Regeln gegen lokales Postgres testen
```

| Datei | Zweck |
|---|---|
| `index.html` | App-Grundgerüst |
| `app.js` | Seiten, Navigation, Formulare |
| `api.js` | Datenzugriff (Supabase oder Demo) |
| `config.js` | Supabase-Zugangsdaten |
| `styles.css` | Design (inkl. Dark Mode) |
| `supabase/schema.sql` | Datenbank, Zugriffsregeln, Aktionen |
| `supabase/tests/` | Sicherheitstests der Zugriffsregeln |
| `vendor/` | Supabase-Bibliothek (lokal, damit kein fremdes CDN nötig ist) |
| `manifest.webmanifest`, `icons/`, `sw.js` | Installierbarkeit & Offline-Start |
| `CNAME` | Eigene Domain für GitHub Pages |
