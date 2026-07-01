type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type InflightEntry = {
  startedAt: number;
  promise: Promise<unknown>;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, InflightEntry>();
const MAX_ENTRIES = 80;
// Si un load() queda colgado (no debería: todos usan AbortSignal.timeout), no bloqueamos la clave
// para siempre. Pasado este umbral, el inflight se considera muerto y se relanza.
const INFLIGHT_MAX_MS = 60_000;

export type CachedOptions<T> = {
  // Solo se persiste en memoria si el resultado pasa este filtro. Sirve para NO cachear 24h
  // respuestas vacías/parciales producto de un fallo upstream (un blip de INEGI fijaría "0").
  shouldCache?: (value: T) => boolean;
};

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: CachedOptions<T> = {}
): Promise<T> {
  const now = Date.now();
  const hit = memoryCache.get(key);
  if (hit) {
    if (hit.expiresAt > now) {
      // LRU: al usarla, muévela al final (la más reciente). Map preserva orden de inserción,
      // así que el desalojo (keys().next()) expulsa la MENOS usada, no la más antigua por insertar.
      memoryCache.delete(key);
      memoryCache.set(key, hit);
      return hit.value as T;
    }
    memoryCache.delete(key); // expirada: purga proactiva.
  }

  const pending = inflight.get(key);
  if (pending && now - pending.startedAt < INFLIGHT_MAX_MS) {
    return pending.promise as Promise<T>;
  }

  const startedAt = now;
  const pendingLoad = load()
    .then((value) => {
      const shouldCache = options.shouldCache ? options.shouldCache(value) : true;
      if (shouldCache) {
        if (memoryCache.size >= MAX_ENTRIES) {
          const oldestKey = memoryCache.keys().next().value as string | undefined;
          if (oldestKey) memoryCache.delete(oldestKey);
        }
        memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      const current = inflight.get(key);
      if (current && current.startedAt === startedAt) inflight.delete(key);
    });

  inflight.set(key, { startedAt, promise: pendingLoad });
  return pendingLoad;
}
