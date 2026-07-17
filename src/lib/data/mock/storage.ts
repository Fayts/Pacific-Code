// Stockage clé/valeur sûr : localStorage dans le navigateur,
// mémoire partout ailleurs (SSR, tests). Toutes les erreurs
// (quota plein, mode privé…) sont silencieusement absorbées.

export interface KVStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryStorage(): KVStorage {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

const memoryFallback = createMemoryStorage();

export function createBrowserStorage(): KVStorage {
  return {
    get(key) {
      try {
        if (typeof window === "undefined") return memoryFallback.get(key);
        return window.localStorage.getItem(key);
      } catch {
        return memoryFallback.get(key);
      }
    },
    set(key, value) {
      try {
        if (typeof window === "undefined") {
          memoryFallback.set(key, value);
          return;
        }
        window.localStorage.setItem(key, value);
      } catch {
        memoryFallback.set(key, value);
      }
    },
    remove(key) {
      try {
        if (typeof window === "undefined") {
          memoryFallback.remove(key);
          return;
        }
        window.localStorage.removeItem(key);
      } catch {
        memoryFallback.remove(key);
      }
    },
  };
}
