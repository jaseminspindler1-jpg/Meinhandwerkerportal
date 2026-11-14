// Supabase-Zugangsdaten (Supabase-Dashboard → Project Settings → API).
// Der "anon"/"publishable" Key ist öffentlich und darf im Code stehen –
// die Datenbank ist über Row Level Security (supabase/schema.sql) geschützt.
// Solange die Werte leer sind, läuft die App im Demo-Modus (Daten nur im Browser).
window.MHP_CONFIG = {
  supabaseUrl: 'https://ameomchsdgkfoeuplwtw.supabase.co',
  supabaseAnonKey: 'sb_publishable_YFgqWpCj-euDPxWEp6MHkg_9SBEm9jq',

  // Wartungsmodus: true = Besucher sehen nur die Seite "Wartungsarbeiten".
  // Du selbst kommst trotzdem in die App, wenn du einmal
  //   https://meinhandwerkerportal.com/?vorschau=an
  // aufrufst (gilt danach auf diesem Gerät; ?vorschau=aus beendet es).
  // Zum Start der Seite einfach auf false setzen.
  maintenance: true,
};
