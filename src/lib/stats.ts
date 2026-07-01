// Ajuste lineal por mínimos cuadrados (OLS), sin librería. Compartido por la vista de Análisis y
// probado en aislamiento (tests/stats.test.ts). Honesto por diseño: expone `degenerate` (varianza
// nula en x → no hay recta) y `n`, para que la UI no dibuje una recta ni presuma un R² espurio.
export type Fit = { slope: number; intercept: number; r2: number; n: number; degenerate: boolean };

export function linearFit(pts: { x: number; y: number }[]): Fit | null {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return { slope: 0, intercept: my, r2: 0, n, degenerate: true };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n, degenerate: false };
}
