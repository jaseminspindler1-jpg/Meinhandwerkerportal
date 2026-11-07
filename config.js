// Supabase-Zugangsdaten (Supabase-Dashboard → Project Settings → API).
// Der "anon"/"publishable" Key ist öffentlich und darf im Code stehen –
// die Datenbank ist über Row Level Security (supabase/schema.sql) geschützt.
// Solange die Werte leer sind, läuft die App im Demo-Modus (Daten nur im Browser).
window.MHP_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
