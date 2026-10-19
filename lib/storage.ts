/**
 * SayBack — Local Storage (IndexedDB)
 *
 * Persists only non-binary data: game settings and saved round metadata.
 * Audio buffers are never written here (no binary audio in localStorage/IndexedDB).
 */

const DB_NAME = 'SayBack';
const DB_VERSION = 1;
const SETTINGS_STORE = 'settings';
const ROUNDS_STORE = 'rounds';

type Db = IDBDatabase | null;
let dbInstance: Db = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(ROUNDS_STORE)) {
        const store = db.createObjectStore(ROUNDS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export interface StoredSettings {
  key: string;
  difficulty: 'easy' | 'medium' | 'hard';
  wordMode: 'preset' | 'custom';
  maxReversedPlays: number;
  maxReconstructedPlays: number;
  soundEnabled: boolean;
  updatedAt: number;
}

export interface StoredRound {
  id: string;
  difficulty: string;
  wordMode: string;
  secretAnswer: string | null;
  guess: string | null;
  correct: boolean | null;
  selfReported: boolean;
  createdAt: number;
  completedAt: number | null;
}

const DEFAULT_SETTINGS: Omit<StoredSettings, 'key' | 'updatedAt'> = {
  difficulty: 'medium',
  wordMode: 'custom',
  maxReversedPlays: 3,
  maxReconstructedPlays: 3,
  soundEnabled: true,
};

export async function getSettings(): Promise<StoredSettings> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SETTINGS_STORE], 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const req = store.get('app-settings');
    req.onsuccess = () => {
      const found = req.result as StoredSettings | undefined;
      resolve(found ? found : { ...DEFAULT_SETTINGS, key: 'app-settings', updatedAt: Date.now() });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSettings(partial: Partial<StoredSettings>): Promise<StoredSettings> {
  const db = await openDb();
  const current = await getSettings();
  const next: StoredSettings = {
    ...current,
    ...partial,
    key: 'app-settings',
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SETTINGS_STORE], 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const req = store.put(next);
    req.onsuccess = () => resolve(next);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRoundMetadata(round: StoredRound): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ROUNDS_STORE], 'readwrite');
    const store = tx.objectStore(ROUNDS_STORE);
    const req = store.put(round);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getRecentRounds(limit = 10): Promise<StoredRound[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ROUNDS_STORE], 'readonly');
    const store = tx.objectStore(ROUNDS_STORE);
    const index = store.index('createdAt');
    const results: StoredRound[] = [];
    const req = index.openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as StoredRound);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function discardRoundMetadata(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ROUNDS_STORE], 'readwrite');
    const store = tx.objectStore(ROUNDS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
