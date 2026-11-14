# E-Mail-Vorlagen für Supabase

Deutsche Mails im Design der App. Einfügen unter
**Supabase → Authentication → Emails → Templates** (bzw. *Email Templates*).

| Vorlage in Supabase | Betreff | Datei |
|---|---|---|
| **Confirm signup** | `Bitte bestätige deine E-Mail-Adresse` | `bestaetigung.html` |
| **Reset password** | `Neues Passwort für Mein Handwerkerportal` | `passwort-zuruecksetzen.html` |
| **Change email address** | `Neue E-Mail-Adresse bestätigen` | `email-aendern.html` |

Pro Vorlage:
1. Vorlage auswählen, **Subject** durch den Betreff aus der Tabelle ersetzen.
2. Im Feld **Message body** (Ansicht *Source*) alles löschen und den kompletten Inhalt der Datei einfügen.
3. **Save changes**.

Die Platzhalter in doppelten geschweiften Klammern (`{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .NewEmail }}`) füllt Supabase beim Versand selbst aus – nicht verändern.

## Absender „Mein Handwerkerportal“ statt „Supabase“
Name und Adresse des Absenders lassen sich nur mit eigenem Mail-Versand (SMTP) ändern:
**Authentication → Emails → SMTP Settings** → *Enable custom SMTP*.

- **Sender email:** z. B. `info@meinhandwerkerportal.com`
- **Sender name:** `Mein Handwerkerportal`
- **Host, Port, Username, Password:** vom Mail-Dienst (z. B. Resend oder Brevo)

Vorher muss die Domain beim Mail-Dienst bestätigt sein (DNS-Einträge bei GoDaddy). Das ist hier
Pflicht, weil die Domain einen DMARC-Eintrag mit `p=reject` hat: Mails von nicht bestätigten
Absendern werden sonst abgelehnt.
