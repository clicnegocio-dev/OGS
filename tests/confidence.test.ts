import { describe, it, expect } from "vitest";
import { assessConfidence, MAX_DOTS } from "@/lib/confidence";

// Confianza por corroboración. Los invariantes de HONESTIDAD son el contrato: un solo medio nunca llega
// al tope; el tope exige medios independientes; la etiqueta distingue recurrencia de corroboración.
describe("assessConfidence", () => {
  it("una sola nota de un medio es 'aislada' (1/4)", () => {
    const c = assessConfidence({ mentions: 1, distinctSources: 1, daysSpan: 0 });
    expect(c.level).toBe("aislada");
    expect(c.dots).toBe(1);
    expect(c.corroborated).toBe(false);
  });

  it("dos notas del mismo medio es 'emergente' (2/4)", () => {
    const c = assessConfidence({ mentions: 2, distinctSources: 1, daysSpan: 5 });
    expect(c.level).toBe("emergente");
    expect(c.dots).toBe(2);
  });

  it("varias notas del mismo medio es 'recurrente' (3/4) y lo dice explícito", () => {
    const c = assessConfidence({ mentions: 5, distinctSources: 1, daysSpan: 74 });
    expect(c.level).toBe("recurrente");
    expect(c.dots).toBe(3);
    expect(c.corroborated).toBe(false);
    expect(c.basis).toContain("74 días");
    expect(c.basis).toContain("no es corroboración");
  });

  it("dos o más medios independientes: 'corroborada' (4/4)", () => {
    const c = assessConfidence({ mentions: 3, distinctSources: 2, daysSpan: 10 });
    expect(c.level).toBe("corroborada");
    expect(c.dots).toBe(MAX_DOTS);
    expect(c.corroborated).toBe(true);
    expect(c.basis).toContain("medios independientes");
  });

  it("HONESTIDAD: un solo medio nunca alcanza el tope, por muchas notas que haya", () => {
    for (const mentions of [1, 3, 10, 50, 500]) {
      const c = assessConfidence({ mentions, distinctSources: 1, daysSpan: 100 });
      expect(c.dots).toBeLessThan(MAX_DOTS);
      expect(c.corroborated).toBe(false);
    }
  });

  it("el tope exige INDEPENDENCIA: 100 notas de 1 medio < 2 notas de 2 medios", () => {
    const uno = assessConfidence({ mentions: 100, distinctSources: 1, daysSpan: 300 });
    const dos = assessConfidence({ mentions: 2, distinctSources: 2, daysSpan: 1 });
    expect(uno.corroborated).toBe(false);
    expect(dos.corroborated).toBe(true);
    expect(dos.dots).toBeGreaterThan(uno.dots);
  });

  it("distinctSources < 1 se trata como 1 (no rompe)", () => {
    const c = assessConfidence({ mentions: 4, distinctSources: 0, daysSpan: 0 });
    expect(c.corroborated).toBe(false);
    expect(c.dots).toBeLessThan(MAX_DOTS);
  });
});
