// Supabase-Zugangsdaten (Supabase-Dashboard → Project Settings → API).
// Der "anon"/"publishable" Key ist öffentlich und darf im Code stehen –
// die Datenbank ist über Row Level Security (supabase/schema.sql) geschützt.
// Solange die Werte leer sind, läuft die App im Demo-Modus (Daten nur im Browser).
window.MHP_CONFIG = {
  supabaseUrl: 'https://ameomchsdgkfoeuplwtw.supabase.co',
  supabaseAnonKey: 'sb_publishable_YFgqWpCj-euDPxWEp6MHkg_9SBEm9jq',

  // Wartungsmodus: true = Besucher sehen nur die Seite "Wartungsarbeiten".
  // Zum Start der Seite auf false setzen.
  maintenance: true,

  // Team-Passwort für die Wartungsseite (Tipp aufs Logo öffnet das Passwortfenster).
  // Erzeugen unter https://meinhandwerkerportal.com/?passwort-erzeugen und die
  // erzeugte Zeile hier eintragen. Leer = Zugang stattdessen über ?vorschau=an.
  // Hier steht nur ein Hash, nie das Passwort selbst.
  maintenancePasswordHash: 'pbkdf2$310000$UPbfvnN0wf9VhdcSfX3TaQ==$ZjeBuw3DWLYHYE2HneAEHXC07vngSzDd/rom324OpBc=',
};
