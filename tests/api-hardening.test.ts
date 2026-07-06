import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "@/lib/rate-limit";
import { cached } from "@/lib/cache";

// Endurecimiento de la superficie de API (auditoría, #A1): rate-limit del endpoint de escritura y
// eviction por namespace de la cache compartida (un flood de una familia no desaloja las caras).

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("permite hasta el límite y luego bloquea con Retry-After", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("ip:a", 3, 10_000, now).allowed).toBe(true);
    }
    const blocked = checkRateLimit("ip:a", 3, 10_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("vuelve a permitir cuando la ventana pasa", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("ip:b", 3, 10_000, t0);
    expect(checkRateLimit("ip:b", 3, 10_000, t0).allowed).toBe(false);
    // Tras la ventana, los hits viejos caen fuera → permite de nuevo.
    expect(checkRateLimit("ip:b", 3, 10_000, t0 + 10_001).allowed).toBe(true);
  });

  it("aísla por clave (una IP no afecta a otra)", () => {
    const now = 2_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("ip:x", 3, 10_000, now);
    expect(checkRateLimit("ip:x", 3, 10_000, now).allowed).toBe(false);
    expect(checkRateLimit("ip:y", 3, 10_000, now).allowed).toBe(true);
  });
});

describe("cache: eviction por namespace", () => {
  it("un flood de un namespace no desaloja las entradas de otro", async () => {
    const keep = await cached("denue-dataset:keep", 60_000, async () => "valioso");
    expect(keep).toBe("valioso");

    // 100 entradas geo:<i> — la familia "geo" se autolimita; no toca "denue-dataset".
    for (let i = 0; i < 100; i++) {
      await cached(`geo:${i}`, 60_000, async () => i);
    }

    // Si "denue-dataset:keep" hubiera sido desalojada, este loader correría y lanzaría.
    const again = await cached("denue-dataset:keep", 60_000, async () => {
      throw new Error("no debía recargar: fue desalojada por el flood");
    });
    expect(again).toBe("valioso");
  });
});
