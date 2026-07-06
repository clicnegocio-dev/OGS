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
// Tope POR NAMESPACE (prefijo antes de ":"): un flood de una familia de claves (p.ej. geo:<ip>, o
// datasets DENUE con `condition` arbitrario) no puede desalojar las entradas caras de otra familia
// (ml-access-token, denue-dataset). #A1 (auditoría): la cache compartida era vaciable por el cliente.
const MAX_PER_NAMESPACE = 24;

function namespaceOf(key: string): string {
  const i = key.indexOf(":");
  return i === -1 ? key : key.slice(0, i);
}

// Desaloja lo justo ANTES de insertar `key`: primero dentro de SU namespace (así una familia ruidosa
// se autolimita sin tocar a las demás), luego el global si aún hiciera falta.
function evictForInsert(key: string): void {
  const ns = namespaceOf(key);
  let nsCount = 0;
  for (const k of memoryCache.keys()) if (namespaceOf(k) === ns) nsCount += 1;
  if (nsCount >= MAX_PER_NAMESPACE) {
    for (const k of memoryCache.keys()) {
      if (namespaceOf(k) === ns) {
        memoryCache.delete(k); // el más antiguo de esa familia (Map preserva orden de inserción)
        break;
      }
    }
  }
  if (memoryCache.size >= MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value as string | undefined;
    if (oldest) memoryCache.delete(oldest);
  }
}
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
        evictForInsert(key);
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
