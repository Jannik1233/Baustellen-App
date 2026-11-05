// Verbindung zum Supabase-Projekt "Frohes Schaffen". Beide Werte sind öffentlich (sie landen ohnehin in der App),
// geschützt wird alles über die Rechte in der Datenbank. Den service_role-Schlüssel niemals hier eintragen.
// Leer lassen = Werte aus der Datei .env nehmen. Sind beide leer, startet die App im Demo-Modus.
export const VERBINDUNG = {
  supabaseUrl: 'https://rjfnhbnzrwappayxsecg.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZm5oYm56cndhcHBheXhzZWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDQ2ODksImV4cCI6MjEwODU4MDY4OX0.sIFGAfAHICdEEclaWCvTnZPCa-0wcU0AAZd58-NH4SM',
  // Öffentlicher Benachrichtigungs-Schlüssel, kommt mit ANLEITUNG.md Schritt 3
  vapidPublicKey: ''
};

export const SUPABASE_URL = VERBINDUNG.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = VERBINDUNG.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const VAPID_PUBLIC_KEY = VERBINDUNG.vapidPublicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
