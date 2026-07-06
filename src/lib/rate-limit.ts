// Rate-limiter en memoria, BEST-EFFORT. Es por-instancia: en serverless multi-instancia NO es un
// límite global (cada lambda tiene su Map) — es un primer freno honesto contra spam, no una garantía.
// Se aplica al único endpoint de ESCRITURA (/api/urban/report), que además reenvía a la puerta pública
// de OIS. Ventana deslizante simple. `now` se inyecta para poder testear sin reloj real. #A1 (auditoría).

const buckets = new Map<string, number[]>(); // key → timestamps (ms) de los hits vivos
const MAX_KEYS = 5000; // cota de memoria: purga si el mapa crece de más

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterMs = Math.max(0, hits[0] + windowMs - now);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > MAX_KEYS) prune(cutoff);
  return { allowed: true, remaining: limit - hits.length, retryAfterMs: 0 };
}

function prune(cutoff: number): void {
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => t > cutoff);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

// Solo para tests: limpia el estado entre casos.
export function __resetRateLimit(): void {
  buckets.clear();
}
