// Zeitgeber: ruft alle 10 Minuten den Zeitplan in Supabase auf.
// Läuft kostenlos als Cloudflare Worker. Hält nebenbei die kostenlose Datenbank wach,
// die sonst nach einer Woche ohne Zugriff einschläft (zum Beispiel über Weihnachten).
//
// Einrichten: siehe ANLEITUNG.md, Abschnitt "Zeitgeber".
// Variablen im Worker: ZEITPLAN_URL (https://<projekt>.supabase.co/functions/v1/zeitplan), ZEITPLAN_GEHEIMNIS

export default {
  async scheduled(_ereignis, env, ctx) {
    ctx.waitUntil(
      fetch(env.ZEITPLAN_URL, { method: 'POST', headers: { 'x-zeitplan-geheimnis': env.ZEITPLAN_GEHEIMNIS } }).then(async (r) => {
        if (!r.ok) console.log('Zeitplan meldet Fehler', r.status, await r.text());
      })
    );
  }
};
