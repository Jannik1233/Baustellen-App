// Kleiner Schlüssel-Wert-Speicher im Browser (IndexedDB). Hält Daten und Dateien auch ohne Netz vor.
// Ist IndexedDB nicht verfügbar (privates Fenster, blockiert), wird nur im Arbeitsspeicher gehalten.

const DB_NAME = 'frohes-schaffen';
const STORE = 'kv';
const ersatz = new Map<string, unknown>();
let dbVersprechen: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (!dbVersprechen) {
    dbVersprechen = new Promise((resolve) => {
      try {
        const anfrage = indexedDB.open(DB_NAME, 1);
        anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(STORE);
        anfrage.onsuccess = () => resolve(anfrage.result);
        anfrage.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbVersprechen;
}

function vorgang<T>(modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve) => {
        if (!d) return resolve(undefined);
        try {
          const anfrage = f(d.transaction(STORE, modus).objectStore(STORE));
          anfrage.onsuccess = () => resolve(anfrage.result as T);
          anfrage.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

export async function lesen<T>(schluessel: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return ersatz.get(schluessel) as T | undefined;
  return vorgang<T>('readonly', (s) => s.get(schluessel));
}

export async function schreiben(schluessel: string, wert: unknown): Promise<void> {
  const d = await db();
  if (!d) {
    ersatz.set(schluessel, wert);
    return;
  }
  await vorgang('readwrite', (s) => s.put(wert, schluessel));
}

export async function entfernen(schluessel: string): Promise<void> {
  const d = await db();
  if (!d) {
    ersatz.delete(schluessel);
    return;
  }
  await vorgang('readwrite', (s) => s.delete(schluessel));
}

export async function schluesselMit(praefix: string): Promise<string[]> {
  const d = await db();
  if (!d) return [...ersatz.keys()].filter((k) => k.startsWith(praefix));
  const alle = (await vorgang<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) ?? [];
  return alle.map(String).filter((k) => k.startsWith(praefix));
}
