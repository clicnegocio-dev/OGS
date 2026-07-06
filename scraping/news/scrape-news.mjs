// Scraper OFFLINE de señales periodísticas (no corre en request-time; es un worker/cron efímero).
// Lee el sitemap de noticias declarado por XEU, deriva señales cívicas de los metadatos
// (título desde slug, sección, fecha), las ubica por colonia y código postal, y materializa un JSON
// que la API solo lee. Plano de LECTURA, efímero (ver scraping/README.md): la ingestión persistente
// es de OIS (Fase 2). Uso: npm run scrape:news   (requiere red; corre en la máquina/CI, no en edge).

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  SOURCES,
  GAZETTEER,
  STATE,
  classifySignal,
  detectColonia,
  detectMunicipio,
  hasCityAnchor,
  slugToTitle,
  parseHeadMetadata
} from "./news-sources.mjs";
import { createRobotsChecker } from "./robots.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "./output");
const OUT_PATH = resolve(OUT_DIR, "news-signals.generated.json");
const MAX_SIGNALS = 500;
// Tope de candidatas atribuidas POR FUENTE antes de ordenar/recortar globalmente. Per-fuente (no
// global) para que un medio con sitemap enorme (XEU) no agote el cupo antes de que las demás fuentes
// aporten sus señales. El recorte fino global es el slice a MAX_SIGNALS de más abajo.
const PER_SOURCE_CAP = MAX_SIGNALS;
const UA = "EcosistemaUrbano/0.1 (+observatorio civico; contacto comercializacion.gj@gmail.com)";

// --- Capa 2 (enriquecimiento citable): parámetros de cortesía y presupuesto por run ---
// Tope de notas a las que se les LEE el <head> por ejecución. Incremental: lo ya enriquecido se
// reutiliza del snapshot previo, así un run típico hace pocas peticiones y converge en 2-3 corridas.
// SCRAPE_ENRICH_LIMIT=0 desactiva la Capa 2 (modo solo-sitemap: título-desde-slug, sin asunto).
const ENRICH_LIMIT = Number.parseInt(process.env.SCRAPE_ENRICH_LIMIT ?? "150", 10);
const ENRICH_CONCURRENCY = 4; // peticiones simultáneas máximas (cortesía con el medio)
const ENRICH_DELAY_MS = 350; // pausa tras cada fetch dentro de un worker

async function main() {
  const signals = [];
  const seen = new Set();

  for (const source of SOURCES) {
    process.stdout.write(`Leyendo sitemap de ${source.name}...\n`);
    // #16: soporta índices de sitemaps (descenso recursivo). Acota a 5 sub-sitemaps.
    const entries = await collectSitemapEntries(source.sitemap, { remaining: 5 });
    // #freshness: el sitemap de XEU viene ordenado de MÁS VIEJO a más nuevo. Sin reordenar, el tope
    // de candidatas se llenaba con notas de hace años y el snapshot quedaba congelado. Ordenamos por
    // lastmod DESC para que las candidatas sean las notas RECIENTES.
    entries.sort((a, b) => (b.lastmod || "").localeCompare(a.lastmod || ""));
    process.stdout.write(`  ${entries.length} URLs en el sitemap\n`);

    // Multi-fuente: un sitemap vacío/ilegible de UN medio no debe abortar todo el run (otras fuentes
    // sí aportan). Se avisa y se salta; el guard de payload vacío global (más abajo) sigue vigente.
    if (entries.length === 0) {
      process.stdout.write(`  (aviso) ${source.name}: sitemap sin URLs usables; se omite esta fuente.\n`);
      continue;
    }

    let taken = 0;
    for (const entry of entries) {
      const parsed = source.parse(entry.loc);
      if (!parsed) continue;

      const classification = classifySignal(parsed.slug);
      if (!classification) continue;

      // Atribución geográfica en 3 niveles, content-driven y por-fuente (mejor evidencia primero):
      //   punto     = colonia reconocida en el slug (entre las que cubre el medio) → coord colonia
      //   municipio = municipio nombrado inequívocamente en el slug, o (medios con taxonomía)
      //               sección de un municipio → centroide municipal
      //   estado    = (medios con taxonomía) sección estatal sin colonia → centroide del estado
      //   (no atribuible a un asentamiento → se descarta; mejor omitir que meter ruido)
      let colonia = null;
      let coloniaSettlement = null;
      for (const cov of source.coverage) {
        const match = detectColonia(parsed.slug, cov);
        if (!match) continue;
        // Colonia de nombre genérico (Zaragoza, Las Vegas, El Dorado…) desde una fuente SIN taxonomía
        // por sección: exige un ancla de ciudad en el slug para no capturar la homónima de otra ciudad.
        if (match.generic && !source.sectionToCity && !hasCityAnchor(parsed.slug, cov)) continue;
        colonia = match;
        coloniaSettlement = cov;
        break;
      }

      let geoScope;
      let settlementId = null;
      let cityName;
      let coord;
      let postalCode;
      if (colonia) {
        geoScope = "punto";
        settlementId = coloniaSettlement;
        cityName = GAZETTEER[settlementId].city;
        coord = { lat: colonia.lat, lng: colonia.lng };
        postalCode = colonia.cp;
      } else {
        const muni = source.coverage.find((cov) => detectMunicipio(parsed.slug, cov));
        if (muni) {
          geoScope = "municipio";
          settlementId = muni;
          cityName = GAZETTEER[muni].city;
          coord = GAZETTEER[muni].center;
          postalCode = GAZETTEER[muni].principalCp;
        } else if (
          source.sectionToCity &&
          parsed.section in source.sectionToCity &&
          source.sectionToCity[parsed.section]
        ) {
          const cs = source.sectionToCity[parsed.section];
          geoScope = "municipio";
          settlementId = cs;
          cityName = GAZETTEER[cs].city;
          coord = GAZETTEER[cs].center;
          postalCode = GAZETTEER[cs].principalCp;
        } else if (source.stateSections && source.stateSections.includes(parsed.section)) {
          geoScope = "estado";
          cityName = STATE.name;
          coord = STATE.center;
          postalCode = null;
        } else {
          continue; // no atribuible a un asentamiento → se descarta
        }
      }

      const id = `${source.id}-${parsed.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const observedAt = (entry.lastmod || "").slice(0, 10) || null;
      // Título: el declarado por el sitemap (Google News) si el medio lo trae; si no, desde el slug.
      const title = source.titleFromSitemap && entry.title ? entry.title : slugToTitle(parsed.slug);

      signals.push({
        id,
        settlementId,
        stateCode: source.stateCode ?? STATE.code,
        city: cityName,
        layer: classification.layer,
        type: classification.type,
        title,
        // Asunto citable (Capa 2): lo llena parseHeadMetadata con og:description del medio. Hasta
        // entonces es null (honesto: no inventamos resumen). La description sigue siendo el disclaimer.
        subject: null,
        enriched: false,
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

      // Cupo POR FUENTE: corta una vez que esta fuente aportó suficientes candidatas; el recorte fino
      // global es el slice de abajo. Así cada medio contribuye (no lo agota el primero).
      taken += 1;
      if (taken >= PER_SOURCE_CAP) break;
    }
    process.stdout.write(`  ${taken} señales atribuidas de ${source.name}\n`);
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

  // Capa 2: enriquece las candidatas ya filtradas con título+asunto citables del <head> (respetando
  // robots.txt en tiempo real, incremental y con tope por run). Muta `trimmed` en sitio.
  const robots = createRobotsChecker({ fetchText, ua: UA, onWarn: (m) => process.stdout.write(`  (aviso) ${m}\n`) });
  const enrich = await enrichSignals(trimmed, robots);
  process.stdout.write(
    `Capa 2: ${enrich.fetched} leídas del <head>, ${enrich.reused} reutilizadas, ` +
      `${enrich.skipped} vetadas por robots, ${enrich.remaining} pendientes para el próximo run.\n`
  );

  // Vintage = fecha real más reciente ya con las fechas de publicación corregidas por la Capa 2.
  const vintage = trimmed.reduce((max, s) => (s.observedAt && s.observedAt > max ? s.observedAt : max), "");
  const enrichedCount = trimmed.filter((s) => s.enriched).length;

  // #C2 (auditoría): frescura POR FUENTE, para que un sitemap rezagado no se esconda tras el vintage
  // global (que toma el máximo de todas). Cada fuente reporta cuántas aportó y su fecha más reciente.
  const bySource = {};
  for (const s of trimmed) {
    const b = (bySource[s.source] ||= { count: 0, maxObservedAt: null });
    b.count += 1;
    if (s.observedAt && (!b.maxObservedAt || s.observedAt > b.maxObservedAt)) b.maxObservedAt = s.observedAt;
  }
  // Fuentes declaradas que NO aportaron nada este run (para no acreditar de más en la UI).
  for (const src of SOURCES) if (!bySource[src.name]) bySource[src.name] = { count: 0, maxObservedAt: null };

  const payload = {
    generatedAt: scrapedAt,
    source: SOURCES.map((s) => s.name).join(", "),
    note: "Señales periodísticas (confidence=reported). URLs descubiertas por sitemap; título y asunto tomados SOLO del <head> declarado por el medio (og:title/og:description) para citar, nunca del cuerpo del artículo. Respeta robots.txt en tiempo real. CP aproximado (semilla); validación fina = SEPOMEX/OIS.",
    vintage,
    total: trimmed.length,
    enriched: enrichedCount,
    byType: countBy(trimmed, "type"),
    byCity: countBy(
      trimmed.filter((s) => s.settlementId),
      "settlementId"
    ),
    byPostalCode: countBy(
      trimmed.filter((s) => s.postalCode),
      "postalCode"
    ),
    byGeoScope: countBy(trimmed, "geoScope"),
    bySource,
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
      // Incluye text/plain y */*: algunos servidores devuelven 406 a robots.txt (text/plain) si el
      // Accept solo pide XML. Sirve igual para sitemaps XML.
      headers: { "User-Agent": UA, Accept: "text/plain, application/xml, text/xml, */*" },
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

// --- Capa 2: enriquecimiento citable ---

// Lee el snapshot previo (si existe) para reutilizar lo ya enriquecido. Incremental = pocos fetch.
async function loadPriorEnrichment() {
  const prior = new Map();
  try {
    const payload = JSON.parse(await readFile(OUT_PATH, "utf8"));
    for (const s of payload.signals || []) {
      if (s.enriched && s.subject) prior.set(s.id, { title: s.title, subject: s.subject, observedAt: s.observedAt });
    }
  } catch {
    // Sin snapshot previo (primer run) → nada que reutilizar.
  }
  return prior;
}

// Enriquece EN SITIO las señales de medios `enrichable`: reutiliza lo previo, y para lo nuevo lee el
// <head> (respetando robots.txt) hasta ENRICH_LIMIT por run. Falla suave: si no se puede leer, la
// señal se queda con su título-desde-slug y sin asunto (honesto), nunca se descarta por eso.
async function enrichSignals(signals, robots) {
  if (ENRICH_LIMIT <= 0) return { fetched: 0, reused: 0, skipped: 0, remaining: 0 };
  // Mapa nombre-del-medio → config, para recuperar brandRe/titleFromSitemap por señal.
  const sourceByName = new Map(SOURCES.map((s) => [s.name, s]));
  const enrichableNames = new Set(SOURCES.filter((s) => s.enrichable).map((s) => s.name));
  const prior = await loadPriorEnrichment();

  let reused = 0;
  const pending = [];
  for (const s of signals) {
    if (!enrichableNames.has(s.source)) continue;
    const p = prior.get(s.id);
    if (p) {
      s.title = p.title || s.title;
      s.subject = p.subject;
      if (p.observedAt) {
        s.observedAt = p.observedAt;
        s.updatedAt = p.observedAt;
      }
      s.enriched = true;
      reused += 1;
    } else {
      pending.push(s);
    }
  }

  const batch = pending.slice(0, ENRICH_LIMIT);
  const remaining = pending.length - batch.length;
  let fetched = 0;
  let skipped = 0;

  await runPool(batch, ENRICH_CONCURRENCY, async (s) => {
    if (!(await robots.isAllowed(s.sourceUrl))) {
      skipped += 1; // robots veta esta ruta → se queda solo-slug
      return;
    }
    try {
      const src = sourceByName.get(s.source);
      const html = await fetchHead(s.sourceUrl);
      const meta = parseHeadMetadata(html, src?.brandRe);
      // No pisar el título si ya vino del sitemap (Google News); el <head> solo aporta el asunto.
      if (meta.title && !src?.titleFromSitemap) s.title = meta.title;
      if (meta.subject) s.subject = meta.subject;
      if (meta.publishedAt) {
        s.observedAt = meta.publishedAt;
        s.updatedAt = meta.publishedAt;
      }
      s.enriched = Boolean(meta.subject || meta.title);
      if (s.enriched) fetched += 1;
    } catch (error) {
      process.stdout.write(`  (aviso) sin enriquecer ${s.id}: ${error.message}\n`);
    }
    await sleep(ENRICH_DELAY_MS);
  });

  return { fetched, reused, skipped, remaining };
}

// GET que ABORTA al ver </head>: obtenemos los metadatos declarados sin descargar el cuerpo del
// artículo (honra "no traer todo el contenido"). Timeout duro de 20s y tope de 512KB por si un medio
// no cierra <head>. Devuelve el fragmento de HTML hasta </head>.
async function fetchHead(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`respondió HTTP ${response.status}`);
    if (!response.body) throw new Error("respuesta sin cuerpo legible");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const MAX_BYTES = 512 * 1024;
    let gotHead = false;
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch {
        break; // abort por timeout → salimos con lo acumulado
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      if (/<\/head>/i.test(buffer)) {
        gotHead = true;
        break;
      }
      if (buffer.length > MAX_BYTES) break;
    }
    controller.abort(); // corta el resto de la descarga (no traemos el cuerpo)
    if (!gotHead && buffer.length === 0) throw new Error("no se pudo leer el <head>");
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

// Ejecuta `worker` sobre `items` con a lo más `size` en paralelo (cortesía con el medio).
async function runPool(items, size, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Decodifica entidades XML (incl. numéricas &#NN; / &#xHH;) y desenvuelve CDATA. El sitemap fresco de
// XEU trae <news:title> en CDATA con entidades hex (&#x20; = espacio).
function decodeXmlEntities(value) {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// Parsea UN documento de sitemap. Devuelve las <url> (loc/lastmod) y, si es un índice
// (<sitemapindex> con <sitemap><loc>), las URLs de los sub-sitemaps para descenso recursivo.
function parseSitemap(xml) {
  const entries = [];
  const subSitemaps = [];

  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  for (const block of urlBlocks) {
    const loc = (block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/) || [])[1];
    // lastmod estándar o, en sitemaps Google News, la fecha de publicación de la nota.
    const lastmod =
      (block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/) || [])[1] ||
      (block.match(/<news:publication_date>\s*([\s\S]*?)\s*<\/news:publication_date>/i) || [])[1];
    // Título declarado en el sitemap (Google News): título real sin costo de fetch.
    const newsTitle = (block.match(/<news:title>\s*([\s\S]*?)\s*<\/news:title>/i) || [])[1];
    if (loc) {
      entries.push({
        loc: decodeXmlEntities(loc.trim()),
        lastmod: lastmod ? lastmod.trim() : null,
        title: newsTitle ? decodeXmlEntities(newsTitle.trim()) : null
      });
    }
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
