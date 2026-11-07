# Meinhandwerkerportal
Plattform zur Vermittlung von Handwerkern und Kunden. Kunden können Aufträge erstellen, Angebote erhalten und Handwerker in ihrer Region finden.

Domain: **meinhandwerkerportal.com**

## Die App (Prototyp)
Progressive Web App (PWA): läuft im Browser unter der Domain und lässt sich auf Handy und PC
wie eine normale App installieren („Zum Startbildschirm hinzufügen“). Funktioniert auch offline.

**Kunden-Modus**
- Handwerker nach Gewerk und PLZ suchen, Profile mit Bewertungen ansehen
- Auftrag erstellen (optional direkt an einen Betrieb)
- Angebote vergleichen und annehmen

**Handwerker-Modus** (oben rechts umschalten)
- Passende Aufträge aus der eigenen Region sehen
- Angebote mit Preis, Termin und Nachricht senden
- Betriebsprofil (Gewerke, Ort, Beschreibung) pflegen

> Hinweis: Der Prototyp hat noch kein Backend. Alle Daten (inkl. Demo-Betrieben) liegen nur im
> Browser des jeweiligen Geräts. Für den echten Betrieb fehlen: Benutzerkonten/Login, Datenbank,
> Benachrichtigungen (E-Mail/Push), Bewertungen, Impressum/Datenschutz.

## Lokal starten
```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Veröffentlichen auf meinhandwerkerportal.com (GitHub Pages)
1. Repository → *Settings* → *Pages* → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
2. Die Datei `CNAME` enthält bereits `meinhandwerkerportal.com`.
3. Beim Domain-Anbieter DNS-Einträge setzen:
   - `A`-Records für `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` für `www` → `jaseminspindler1-jpg.github.io`
4. In den Pages-Einstellungen „Enforce HTTPS“ aktivieren (nötig für die App-Installation).

## Dateien
| Datei | Zweck |
|---|---|
| `index.html` | App-Grundgerüst |
| `app.js` | Logik, Seiten, Demo-Daten |
| `styles.css` | Design (inkl. Dark Mode) |
| `manifest.webmanifest`, `icons/` | Installierbarkeit als App |
| `sw.js` | Service Worker (Offline) |
| `CNAME` | Eigene Domain für GitHub Pages |
