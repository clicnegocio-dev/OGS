import { describe, it, expect } from "vitest";
import { linearFit } from "@/lib/stats";

// Ajuste lineal (OLS). El bug histórico aquí era presumir un R² espurio; estos tests fijan el contrato
// honesto: N<2 no hay recta, x sin varianza es "degenerate", y sin varianza da R²=0 (no NaN).
describe("linearFit", () => {
  it("devuelve null con menos de 2 puntos", () => {
    expect(linearFit([])).toBeNull();
    expect(linearFit([{ x: 1, y: 1 }])).toBeNull();
  });

  it("recupera una recta perfecta y=2x+1 con R²=1", () => {
    const fit = linearFit([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 }
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.degenerate).toBe(false);
    expect(fit!.slope).toBeCloseTo(2, 10);
    expect(fit!.intercept).toBeCloseTo(1, 10);
    expect(fit!.r2).toBeCloseTo(1, 10);
    expect(fit!.n).toBe(4);
  });

  it("marca degenerate cuando x no tiene varianza (recta vertical)", () => {
    const fit = linearFit([
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 }
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.degenerate).toBe(true);
    expect(fit!.slope).toBe(0);
    expect(fit!.intercept).toBeCloseTo(2, 10); // media de y
    expect(fit!.r2).toBe(0);
  });

  it("da R²=0 (no NaN) cuando y es constante", () => {
    const fit = linearFit([
      { x: 0, y: 4 },
      { x: 1, y: 4 },
      { x: 2, y: 4 }
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.degenerate).toBe(false);
    expect(fit!.slope).toBeCloseTo(0, 10);
    expect(fit!.r2).toBe(0);
    expect(Number.isNaN(fit!.r2)).toBe(false);
  });

  it("una nube ruidosa da 0 < R² < 1", () => {
    const fit = linearFit([
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 4 },
      { x: 4, y: 3 },
      { x: 5, y: 6 }
    ]);
    expect(fit).not.toBeNull();
    expect(fit!.r2).toBeGreaterThan(0);
    expect(fit!.r2).toBeLessThan(1);
  });
});
