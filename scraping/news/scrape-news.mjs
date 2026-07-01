// Scraper OFFLINE de señales periodísticas (no corre en request-time; es un worker/cron efímero).
// Lee el sitemap de noticias declarado por XEU, deriva señales cívicas de los metadatos
// (título desde slug, sección, fecha), las ubica por colonia y código postal, y materializa un JSON
// que la API solo lee. Plano de LECTURA, efímero (ver scraping/README.md): la ingestión persistente
// es de OIS (Fase 2). Uso: npm run scrape:news   (requiere red; corre en la máquina/CI, no en edge).

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  SOURCES,
  GAZETTEER,
  STATE,
  classifySignal,
  detectColonia,
  slugToTitle,
  parseArticleUrl
} from "./news-sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "./output");
const OUT_PATH = resolve(OUT_DIR, "news-signals.generated.json");
const MAX_SIGNALS = 500;
// #36: tope de candidatas a procesar antes de ordenar/recortar (evita recorrer sitemaps enteros).
const MAX_CANDIDATES = MAX_SIGNALS * 4;
const UA = "EcosistemaUrbano/0.1 (+observatorio civico; contacto comercializacion.gj@gmail.com)";

async function main() {
  const signals = [];
  const seen = new Set();

  for (const source of SOURCES) {
    process.stdout.write(`Leyendo sitemap de ${source.name}...\n`);
    // #16: soporta índices de sitemaps (descenso recursivo). Acota a 5 sub-sitemaps.
    const entries = await collectSitemapEntries(source.sitemap, { remaining: 5 });
    process.stdout.write(`  ${entries.length} URLs en el sitemap\n`);

    // #16: si el sitemap no produjo URLs (formato no reconocido o índice vacío), aborta en vez
    // de escribir un payload total:0 que borraría las señales ya generadas.
    if (entries.length === 0) {
      throw new Error(
        `${source.name}: el sitemap no produjo URLs (¿formato no reconocido o índice vacío?). ` +
          `Abortando para no sobrescribir señales con un payload vacío.`
      );
    }

    for (const entry of entries) {
      const parsed = parseArticleUrl(entry.loc);
      if (!parsed) continue;
      if (!(parsed.section in source.sectionToCity)) continue;

      const classification = classifySignal(parsed.slug);
      if (!classification) continue;

      // Atribución geográfica en 3 niveles (la nota pertenece a donde sucede el hecho; si no, al
      // municipio; si no, al estado — según lo que la nota deja ver en sección/slug):
      //   punto     = colonia reconocida en el slug   → coord de la colonia
      //   municipio = sección de un municipio sin colonia → centroide municipal
      //   estado    = sección estatal sin colonia      → centroide del estado
      //   (ambigua sin colonia ni sección estatal → no se puede atribuir → se descarta)
      let citySlug = source.sectionToCity[parsed.section];
      let colonia = citySlug ? detectColonia(parsed.slug, citySlug) : null;
      if (!citySlug) {
        for (const candidate of Object.keys(GAZETTEER)) {
          const match = detectColonia(parsed.slug, candidate);
          if (match) {
            citySlug = candidate;
            colonia = match;
            break;
          }
        }
      }

      let geoScope;
      let settlementId;
      let cityName;
      let coord;
      let postalCode;
      if (colonia) {
        geoScope = "punto";
        settlementId = citySlug;
        cityName = GAZETTEER[citySlug].city;
        coord = { lat: colonia.lat, lng: colonia.lng };
        postalCode = colonia.cp;
      } else if (citySlug) {
        geoScope = "municipio";
        settlementId = citySlug;
        cityName = GAZETTEER[citySlug].city;
        coord = GAZETTEER[citySlug].center;
        postalCode = GAZETTEER[citySlug].principalCp;
      } else if (source.stateSections.includes(parsed.section)) {
        geoScope = "estado";
        settlementId = null;
        cityName = STATE.name;
        coord = STATE.center;
        postalCode = null;
      } else {
        continue; // ambigua sin colonia ni sección estatal → no se atribuye → se descarta
      }

      const id = `xeu-${parsed.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const observedAt = (entry.lastmod || "").slice(0, 10) || null;

      signals.push({
        id,
        settlementId,
        stateCode: source.stateCode,
        city: cityName,
        layer: classification.layer,
        type: classification.type,
        title: slugToTitle(parsed.slug),
        description: `Señal periodística detectada en el titular de ${source.name}. No es un hecho verificado: revisa la nota original.`,
        lat: coord.lat,
        lng: coord.lng,
        severity: classification.severity,
        confidence: "reported",
        source: source.name,
        sourceUrl: entry.loc,
        observedAt,
        // #36: la frescura es la fecha real de la nota (observedAt), no el día del scrape.
        // El día del run vive en payload.generatedAt.
        updatedAt: observedAt,
        privacy: "public",
        section: parsed.section,
        colonia: colonia ? colonia.name : null,
        postalCode,
        geoScope
      });

      // #36: corta una vez acumuladas suficientes candidatas; el recorte fino es el slice de abajo.
      if (signals.length >= MAX_CANDIDATES) break;
    }
    if (signals.length >= MAX_CANDIDATES) break;
  }

  // Por NIVEL de evidencia espacial primero (punto > municipio > estado), luego más recientes.
  const scopeRank = { punto: 0, municipio: 1, estado: 2 };
  signals.sort((a, b) => {
    const ra = scopeRank[a.geoScope] ?? 3;
    const rb = scopeRank[b.geoScope] ?? 3;
    if (ra !== rb) return ra - rb; // punto primero (mejor evidencia), estado al final
    // #36: observedAt null/ausente es el MÍNIMO (cae al fondo), no se trata como "más reciente".
    const ao = a.observedAt || "";
    const bo = b.observedAt || "";
    if (ao === bo) return 0;
    if (!ao) return 1; // a sin fecha → después de b
    if (!bo) return -1; // b sin fecha → después de a
    return bo.localeCompare(ao); // descendente: fecha mayor (más reciente) primero
  });

  const trimmed = signals.slice(0, MAX_SIGNALS);
  const scrapedAt = new Date().toISOString();
  // #16: nunca escribas un payload vacío (borraría las señales ya publicadas).
  if (trimmed.length === 0) {
    throw new Error("No se generó ninguna señal cívica; se conserva el JSON existente (no se sobrescribe).");
  }

  const vintage = trimmed.reduce((max, s) => (s.observedAt && s.observedAt > max ? s.observedAt : max), "");

  const payload = {
    generatedAt: scrapedAt,
    source: SOURCES.map((s) => s.name).join(", "),
    note: "Señales periodísticas (confidence=reported). Derivadas solo de metadatos de sitemap (título/URL/fecha); no se descargan cuerpos de artículos. Respeta robots.txt. CP aproximado (semilla); validación fina = SEPOMEX/OIS.",
    vintage,
    total: trimmed.length,
    byType: countBy(trimmed, "type"),
    byCity: countBy(trimmed.filter((s) => s.settlementId), "settlementId"),
    byPostalCode: countBy(trimmed.filter((s) => s.postalCode), "postalCode"),
    byGeoScope: countBy(trimmed, "geoScope"),
    signals: trimmed
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  process.stdout.write(
    `\nEscritas ${trimmed.length} señales → ${OUT_PATH}\n` +
      `Por nivel: ${JSON.stringify(payload.byGeoScope)}\nPor CP: ${JSON.stringify(payload.byPostalCode)}\nVintage: ${vintage}\n`
  );
}

// #17: nunca colgarse. Timeout duro de 20s por intento (AbortSignal.timeout) y 1-2 reintentos
// con backoff corto antes de propagar el error. Conserva el User-Agent declarado.
async function fetchText(url, attempt = 0) {
  const backoffs = [500, 1500];
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/xml,text/xml" },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempt < backoffs.length) {
      await new Promise((r) => setTimeout(r, backoffs[attempt]));
      return fetchText(url, attempt + 1);
    }
    throw error;
  }
}

// Decodifica las entidades XML básicas que pueden aparecer dentro de <loc>.
function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

// Parsea UN documento de sitemap. Devuelve las <url> (loc/lastmod) y, si es un índice
// (<sitemapindex> con <sitemap><loc>), las URLs de los sub-sitemaps para descenso recursivo.
function parseSitemap(xml) {
  const entries = [];
  const subSitemaps = [];

  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  for (const block of urlBlocks) {
    const loc = (block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/) || [])[1];
    const lastmod = (block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/) || [])[1];
    if (loc) entries.push({ loc: decodeXmlEntities(loc.trim()), lastmod: lastmod ? lastmod.trim() : null });
  }

  // #16: si no hay <url> pero sí es un índice de sitemaps, extrae los <loc> de cada <sitemap>.
  if (entries.length === 0 && (/<sitemapindex/i.test(xml) || /<sitemap[\s>]/i.test(xml))) {
    const sitemapBlocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
    for (const block of sitemapBlocks) {
      const loc = (block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/) || [])[1];
      if (loc) subSitemaps.push(decodeXmlEntities(loc.trim()));
    }
  }

  return { entries, subSitemaps };
}

// Lee un sitemap y, si es un índice, desciende recursivamente acumulando las <url> de los
// sub-sitemaps. `budget` acota el total de sub-sitemaps que se descargan (#16: máx 5) para
// no colgarse ni recorrer índices enormes.
async function collectSitemapEntries(url, budget) {
  const xml = await fetchText(url);
  const { entries, subSitemaps } = parseSitemap(xml);
  if (entries.length > 0 || subSitemaps.length === 0) return entries;

  const all = [];
  for (const sub of subSitemaps) {
    if (budget.remaining <= 0) break;
    budget.remaining -= 1;
    try {
      all.push(...(await collectSitemapEntries(sub, budget)));
    } catch (error) {
      process.stdout.write(`  (aviso) sub-sitemap omitido: ${sub} — ${error.message}\n`);
    }
  }
  return all;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
