/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Leer lassen für den Demo-Modus. Werte stehen in der Datei .env (siehe ANLEITUNG.md).
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
