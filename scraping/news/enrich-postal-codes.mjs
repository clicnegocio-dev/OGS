// Enriquecimiento OFFLINE (sin red): añade `postalCode` a las señales ya generadas, mapeando
// colonia→CP del gazetteer (else CP de respaldo del municipio), y recalcula `byPostalCode`.
// Útil para tener código postal en el dataset existente SIN re-scrapear. Idempotente.
// Uso: npm run enrich:news-cp

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cpForColonia, principalCp } from "./news-sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "./output/news-signals.generated.json");

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const payload = JSON.parse(await readFile(OUT_PATH, "utf8"));
  const signals = Array.isArray(payload.signals) ? payload.signals : [];

  let assigned = 0;
  for (const s of signals) {
    const cp = cpForColonia(s.settlementId, s.colonia) ?? principalCp(s.settlementId) ?? null;
    s.postalCode = cp;
    if (cp) assigned += 1;
    // Migración a 3 niveles: geoPrecision (colonia|municipio) → geoScope (punto|municipio|estado).
    if (!s.geoScope) s.geoScope = s.geoPrecision === "colonia" ? "punto" : "municipio";
    // Datos actuales = Veracruz (clave INEGI 30). El scraper nuevo lo emite por medio.
    if (!s.stateCode) s.stateCode = "30";
    // Cierra la migración: geoScope es el único nombre canónico; se retira el residual geoPrecision.
    delete s.geoPrecision;
  }

  payload.byPostalCode = countBy(signals.filter((s) => s.postalCode), "postalCode");
  payload.byGeoScope = countBy(signals, "geoScope");
  if (!payload.note || !payload.note.includes("CP")) {
    payload.note = `${payload.note || ""} CP aproximado (semilla); validación fina = SEPOMEX/OIS.`.trim();
  }

  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  process.stdout.write(
    `Enriquecidas ${assigned}/${signals.length} señales con código postal → ${OUT_PATH}\n` +
      `Por CP: ${JSON.stringify(payload.byPostalCode)}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
