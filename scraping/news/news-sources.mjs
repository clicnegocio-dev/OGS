// Config del scraper de señales periodísticas (plano de LECTURA, efímero; ver scraping/README.md).
//
// CUMPLIMIENTO (principio del proyecto: respetar robots.txt y términos). El permiso se verifica EN
// TIEMPO DE EJECUCIÓN (scraping/news/robots.mjs), no por comentario: antes de leer el <head> de una
// nota preguntamos a robots.txt; si un medio bloquea, la Capa 2 se degrada sola al título-desde-slug.
// Descubrimos URLs por el sitemap declarado de cada medio (loc/lastmod, o <news:title> cuando el
// sitemap lo trae) y, para las candidatas YA atribuidas a un asentamiento, leemos SOLO el <head>
// (og:title = título real, og:description = ASUNTO, article:published_time = fecha) abortando en
// </head>. NUNCA descargamos ni almacenamos el cuerpo del artículo: guardamos título+asunto+enlace+
// fecha para citar. Lo que producimos es una SEÑAL PERIODÍSTICA (confidence "reported"), no un hecho.
//
// INVENTARIO DE MEDIOS LOCALES (relevado 2026-07-06). Integramos los que (a) permiten crawl en su
// robots.txt, (b) publican sitemap usable y (c) aportan señal a NIVEL DE ASENTAMIENTO (colonia/
// municipio de Veracruz-Boca). Los demás se registran aquí, no se cablean (evita cientos de
// peticiones por ~0 señal atribuible = descortés e inútil):
//   INTEGRADOS:
//   - xeu.mx           → sitemap de noticias; robots permite contenido; mejor rendimiento local.
//   - plumaslibres.com.mx → sitemap WP; robots ok; aporta colonias reales (Río Medio, Centro…).
//   - eldictamen.mx    → Google News sitemap con <news:title> (título sin costo); puerto de Veracruz.
//   FUERA por robots (Disallow: /): imagendeveracruz.mx, imagendelgolfo.mx.
//   EVALUADOS, DIFERIDOS por ~0 atribución de asentamiento (estatales/nacionales): jornadaveracruz,
//     versiones, palabrasclaras, e-veracruz(→e-consulta), diariodexalapa(→OEM/Xalapa).
//   NO USABLES ahora: alcalorpolitico (sitemap 500), avcnoticias (sin sitemap), notiver/olivanews/
//     veracruzanos/masnoticias/formato7 (inalcanzables o timeout). Revisar en el futuro.
// El permiso a robots.txt se reverifica EN CADA RUN (robots.mjs); si un medio bloquea, esa nota cae
// a modo solo-slug (sin asunto) o se omite del enriquecimiento.
//
// CÓDIGO POSTAL (esta fase): cada colonia del gazetteer lleva un `cp` APROXIMADO (semilla), y cada
// medio declara la `coverage` de municipios donde OPERA. De ahí derivamos POSTAL_INDEX: la vista
// "señales por código postal donde operan medios". La validación fina CP↔colonia (SEPOMEX / Marco
// Geoestadístico) es trabajo de OIS; aquí es semilla honesta, no domicilio.

// Parser genérico para medios con URL "plana" o con fecha (WordPress, etc.): toma el ÚLTIMO segmento
// de la ruta como slug del titular. Descarta segmentos que no parecen artículo (sin guion o cortos:
// son categorías/tags). id = slug (estable y único por nota). section = null (sin taxonomía en URL).
export function lastSegmentParser(host) {
  const hostRe = new RegExp(`^https?://(?:www\\.)?${host.replace(/\./g, "\\.")}/`, "i");
  return (loc) => {
    if (!hostRe.test(loc)) return null;
    let pathname;
    try {
      pathname = new URL(loc).pathname;
    } catch {
      return null;
    }
    const segs = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const slug = (segs.pop() || "").toLowerCase();
    if (!slug.includes("-") || slug.length < 12) return null; // no es un titular-slug
    return { section: null, id: slug, slug };
  };
}

export const SOURCES = [
  {
    id: "xeu",
    name: "XEU Noticias (medio)",
    // El sitemap-noticias.xml quedó CONGELADO en 2025-08-02; el vivo es el año-scopeado (2025-26), que
    // llega al día de hoy y trae <news:publication_date>/<news:title>. (Auditoría 2026-07, C2.)
    sitemap: "https://www.xeu.mx/sitemaps/sitemap-noticias-25-26.xml",
    parse: parseArticleUrl, // XEU: /<seccion>/<id>/<slug> (tiene taxonomía por sección)
    brandRe: /\s*[-|–]\s*xeu\b.*$/i,
    // Capa 2: leer el <head> de la nota (og:title/og:description) para título+asunto citables.
    // El permiso real se reverifica contra robots.txt en cada run; esto solo lo habilita.
    enrichable: true,
    // Municipios donde opera el medio (define qué CPs cubre, vía el gazetteer).
    coverage: ["boca-del-rio", "veracruz"],
    // Estado del medio (clave INEGI). Las notas a nivel ESTADO se atribuyen aquí.
    stateCode: "30",
    // Solo secciones locales y cívicas. Espectáculos/deportes/nacional se descartan como ruido.
    sectionToCity: {
      "boca-del-rio": "boca-del-rio",
      veracruz: "veracruz",
      "estado-de-veracruz": null, // sin municipio fijo: PUNTO si hay colonia; si no, nivel ESTADO
      policiaca: null,
      sociedad: null
    },
    // Secciones que, SIN colonia reconocible, se atribuyen al ESTADO (no se descartan).
    stateSections: ["estado-de-veracruz"]
  },
  {
    id: "plumaslibres",
    name: "Plumas Libres (medio)",
    sitemap: "https://plumaslibres.com.mx/sitemap.xml", // índice WP → post-sitemaps por año
    parse: lastSegmentParser("plumaslibres.com.mx"), // URL con fecha: /YYYY/MM/DD/<slug>/
    brandRe: /\s*[-|–]\s*plumas libres\s*$/i,
    enrichable: true,
    stateCode: "30",
    // Sin taxonomía por sección: la atribución es 100% content-driven (colonia/municipio en el slug).
    coverage: ["veracruz", "boca-del-rio"]
  },
  {
    id: "eldictamen",
    name: "El Dictamen (medio)",
    sitemap: "https://www.eldictamen.mx/gn_sitemap.xml", // Google News: trae <news:title> y fecha
    parse: lastSegmentParser("eldictamen.mx"), // URL plana: /<slug>/
    brandRe: /\s*[-|–]\s*el dictamen\s*$/i,
    titleFromSitemap: true, // el título real ya viene en <news:title>; el <head> solo aporta asunto
    enrichable: true,
    stateCode: "30",
    coverage: ["veracruz", "boca-del-rio"]
  }
];

// Gazetteer semilla de colonias/fraccionamientos con coordenada aproximada (centroide) y CP semilla.
// Honestidad: la precisión es "colonia" (aprox), no domicilio; el CP es aproximado del municipio/zona.
// Ampliable; el detalle fino llega con geocodificación/Marco Geoestadístico/SEPOMEX en OIS.
export const GAZETTEER = {
  "boca-del-rio": {
    city: "Boca del Río",
    center: { lat: 19.1056, lng: -96.1067 },
    // CP de respaldo cuando la nota no resuelve colonia (centroide municipal).
    principalCp: "94290",
    // Claves INEQUÍVOCAS del municipio en un slug → atribución MUNICIPIO (sin colonia). "boca-del-rio"
    // es específico; evitamos tokens ambiguos.
    municipioKeys: ["boca-del-rio"],
    // Tokens de ciudad que ANCLAN una colonia de nombre genérico a este municipio (evita capturar la
    // homónima de otra ciudad desde fuentes estatales). Ver `generic` en las colonias y hasCityAnchor.
    cityAnchors: ["boca", "boca-del-rio"],
    colonias: [
      { name: "Costa de Oro", keys: ["costa-de-oro"], lat: 19.1386, lng: -96.1086, cp: "94299" },
      { name: "Mocambo", keys: ["mocambo"], lat: 19.1297, lng: -96.1075, cp: "94293" },
      {
        name: "Boca del Río Centro",
        keys: ["centro-de-boca", "centro-historico-de-boca"],
        lat: 19.1056,
        lng: -96.1011,
        cp: "94290"
      },
      // generic: nombres que existen en otras ciudades (El Dorado en Córdoba, Las Américas, etc.).
      { name: "El Dorado", keys: ["el-dorado"], lat: 19.1208, lng: -96.119, cp: "94297", generic: true },
      { name: "Costa Verde", keys: ["costa-verde"], lat: 19.165, lng: -96.124, cp: "94294" },
      { name: "Floresta", keys: ["floresta"], lat: 19.158, lng: -96.13, cp: "94298", generic: true },
      { name: "Las Américas", keys: ["las-americas"], lat: 19.146, lng: -96.135, cp: "94298", generic: true },
      { name: "Ylang Ylang", keys: ["ylang-ylang", "ylang"], lat: 19.135, lng: -96.108, cp: "94293" },
      // Solo la clave específica: "riviera" suelto pegaba de pasada otras "riviera-*" (p.ej. Riviera Maya).
      { name: "Riviera Veracruzana", keys: ["riviera-veracruzana"], lat: 19.04, lng: -96.09, cp: "94277" },
      {
        name: "Fraccionamiento Reforma",
        keys: ["fraccionamiento-reforma"],
        lat: 19.15,
        lng: -96.12,
        cp: "94297",
        generic: true
      }
    ]
  },
  veracruz: {
    city: "Veracruz",
    center: { lat: 19.1903, lng: -96.1533 },
    principalCp: "91700",
    // "veracruz" suelto es ambiguo (estado vs. ciudad vs. puerto): solo compuestos inequívocos que
    // denotan el MUNICIPIO/puerto. Preferimos sub-atribuir a mal-atribuir.
    municipioKeys: ["puerto-de-veracruz", "veracruz-puerto", "ciudad-de-veracruz"],
    cityAnchors: ["veracruz", "puerto"],
    colonias: [
      // "centro-historico" a secas pegaba el centro histórico de Xalapa/Coatepec en fuentes estatales.
      // Exigimos la ciudad para atribuir a Veracruz (precisión sobre recall: mejor omitir que confundir).
      {
        name: "Centro",
        keys: ["centro-de-veracruz", "centro-historico-de-veracruz"],
        lat: 19.2003,
        lng: -96.1342,
        cp: "91700"
      },
      { name: "Reforma", keys: ["colonia-reforma"], lat: 19.183, lng: -96.14, cp: "91919", generic: true },
      { name: "Zaragoza", keys: ["zaragoza"], lat: 19.19, lng: -96.145, cp: "91910", generic: true },
      { name: "Playa Linda", keys: ["playa-linda"], lat: 19.17, lng: -96.13, cp: "91810" },
      { name: "Las Bajadas", keys: ["las-bajadas"], lat: 19.13, lng: -96.21, cp: "91697" },
      { name: "Pocitos y Rivera", keys: ["pocitos-y-rivera", "pocitos"], lat: 19.205, lng: -96.16, cp: "91775" },
      { name: "Río Medio", keys: ["rio-medio"], lat: 19.18, lng: -96.19, cp: "91808" },
      { name: "Tarimoya", keys: ["tarimoya"], lat: 19.22, lng: -96.17, cp: "91775" },
      { name: "Formando Hogar", keys: ["formando-hogar"], lat: 19.18, lng: -96.16, cp: "91897" },
      { name: "Las Vegas", keys: ["las-vegas"], lat: 19.16, lng: -96.16, cp: "91868", generic: true }
    ]
  }
};

// ¿El slug contiene un token de ciudad de este asentamiento? Ancla para colonias de nombre genérico
// (Zaragoza, Las Vegas, El Dorado…) atribuidas desde fuentes estatales sin taxonomía por sección.
export function hasCityAnchor(slug, settlementId) {
  const gaz = GAZETTEER[settlementId];
  if (!gaz?.cityAnchors) return false;
  const tokens = slug.split("-");
  return gaz.cityAnchors.some((key) => stemMatchesSlug(slug, tokens, key));
}

// Atribución a nivel ESTADO: punto de referencia para notas que hablan del estado sin municipio
// (centroide ~ capital Xalapa). geoScope "estado" = la menor precisión geográfica.
export const STATE = { code: "30", name: "Veracruz", center: { lat: 19.5438, lng: -96.9102 } };

// CP de respaldo del municipio (centroide) cuando la nota no resuelve colonia.
export function principalCp(settlementId) {
  return GAZETTEER[settlementId]?.principalCp ?? null;
}

// CP de una colonia por nombre (el dato que el scraper ya guarda en cada señal). null si no mapea.
export function cpForColonia(settlementId, coloniaName) {
  if (!coloniaName) return null;
  const gaz = GAZETTEER[settlementId];
  if (!gaz) return null;
  return gaz.colonias.find((c) => c.name === coloniaName)?.cp ?? null;
}

// Vista "por código postal donde operan medios": cada CP del gazetteer con su colonia, municipio,
// centroide y los medios que OPERAN en ese municipio (SOURCES.coverage). Es la estructura cívica que
// EU posee; OIS no la modela (viaja en el sobre cuando una señal cruza a OIS).
export const POSTAL_INDEX = Object.entries(GAZETTEER).flatMap(([settlementId, gaz]) =>
  gaz.colonias.map((c) => ({
    cp: c.cp,
    colonia: c.name,
    settlementId,
    city: gaz.city,
    lat: c.lat,
    lng: c.lng,
    outlets: SOURCES.filter((s) => s.coverage.includes(settlementId)).map((s) => s.name)
  }))
);

// Clasificador de tipo de señal por stems robustos a acentos (los slugs de XEU eliminan acentos
// de forma inconsistente: "kilómetros" → "kilmetros"). Cada tipo mapea a capa + severidad.
const CLASSIFIERS = [
  { type: "inundacion", layer: "ambiental", severity: "high", stems: ["inund", "encharc", "desbord", "anegad"] },
  // "el-norte" (antes "norte-de-"): captura el viento "Norte" sin pegar el falso positivo
  // geográfico "norte-de-veracruz" (región, no clima). "calor" queda como token completo (abajo).
  {
    type: "clima",
    layer: "ambiental",
    severity: "medium",
    stems: ["lluvi", "tormenta", "ciclon", "huracan", "frente-frio", "el-norte", "calor", "granizo"]
  },
  {
    type: "accidente",
    layer: "urbano",
    severity: "high",
    stems: ["accidente", "choque", "atropell", "volcad", "derrap", "carambola"]
  },
  {
    type: "movilidad",
    layer: "urbano",
    severity: "medium",
    stems: ["trafico", "vial", "bloqueo", "cierre-de-", "fila", "embotell", "transporte"]
  },
  {
    type: "infraestructura",
    layer: "urbano",
    severity: "medium",
    stems: ["bache", "socavon", "obra", "baden", "puente", "drenaje", "banqueta", "alumbrado", "pavimentac"]
  },
  {
    type: "servicios",
    layer: "urbano",
    severity: "high",
    stems: ["sin-agua", "corte-de-agua", "desabasto", "fuga-de-agua", "apagon", "sin-luz", "fuga-de-gas", "cfe"]
  },
  {
    type: "inseguridad",
    layer: "institucional",
    severity: "high",
    stems: [
      "robo",
      "asalt",
      "balac",
      "homicid",
      "ejecut",
      "secuestr",
      "violenc",
      "narco",
      "extorsion",
      "feminicid",
      "disparos"
    ]
  },
  {
    type: "gobierno",
    layer: "institucional",
    severity: "low",
    stems: ["alcald", "ayuntamiento", "gobernador", "edil", "regidor", "presupuesto", "obra-publica", "licitac"]
  },
  {
    type: "comercio",
    layer: "economico",
    severity: "low",
    stems: ["comercio", "negocio", "empleo", "inversion", "turism", "economi", "mercado"]
  },
  {
    type: "social",
    layer: "social",
    severity: "low",
    stems: ["manifestac", "marcha", "protesta", "vecinos", "comunidad", "colectiv"]
  }
];

// Stems SIN guion que solo deben pegar como token COMPLETO (no como prefijo de palabra),
// para evitar falsos positivos por substring conocidos: "obra"⊂"obrador" (López Obrador),
// "calor"⊂"caloria", "fila"⊂(palabras como "perfil"/"desfile"). Ver __selfTest() al final.
const EXACT_TOKEN_STEMS = new Set(["obra", "fila", "calor"]);

// Match de un stem contra un slug respetando límites de token (el slug viene separado por "-").
//  - stem CON guion (p.ej. "sin-agua", "frente-frio", "cierre-de-"): subcadena anclada a límite
//    de token. Si el stem termina en "-" se trata como prefijo de token (debe iniciar en borde
//    de token); si no, debe ir rodeado por bordes de token ("-stem-" dentro del slug acolchado).
//  - stem SIN guion en EXACT_TOKEN_STEMS: solo si algún token es exactamente el stem.
//  - stem SIN guion normal: si algún token es el stem O empieza con el stem (prefijo de palabra),
//    nunca a mitad de otra palabra.
function stemMatchesSlug(slug, tokens, stem) {
  if (stem.includes("-")) {
    const padded = `-${slug}-`;
    return stem.endsWith("-") ? padded.includes(`-${stem}`) : padded.includes(`-${stem}-`);
  }
  if (EXACT_TOKEN_STEMS.has(stem)) {
    return tokens.includes(stem);
  }
  return tokens.some((token) => token === stem || token.startsWith(stem));
}

export function classifySignal(slug) {
  const tokens = slug.split("-");
  for (const classifier of CLASSIFIERS) {
    if (classifier.stems.some((stem) => stemMatchesSlug(slug, tokens, stem))) {
      return { type: classifier.type, layer: classifier.layer, severity: classifier.severity };
    }
  }
  return null; // sin señal cívica reconocible → se descarta (espectáculos, deportes, etc.)
}

export function detectColonia(slug, citySlug) {
  const gaz = GAZETTEER[citySlug];
  if (!gaz) return null;
  const tokens = slug.split("-");
  for (const colonia of gaz.colonias) {
    if (colonia.keys.some((key) => stemMatchesSlug(slug, tokens, key))) return colonia;
  }
  return null;
}

// ¿El slug nombra INEQUÍVOCAMENTE al municipio (sin resolver colonia)? Usa municipioKeys del
// gazetteer. Atribución MUNICIPIO content-driven para medios sin taxonomía por sección.
export function detectMunicipio(slug, citySlug) {
  const gaz = GAZETTEER[citySlug];
  if (!gaz?.municipioKeys) return false;
  const tokens = slug.split("-");
  return gaz.municipioKeys.some((key) => stemMatchesSlug(slug, tokens, key));
}

// Reconstruye un título legible desde el slug ("lleg-el-dia" → "Lleg el dia"). Es aproximado
// (XEU ya removió acentos en el slug); sirve como extracto, con enlace a la nota original.
export function slugToTitle(slug) {
  const text = slug.replace(/-/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Estructura POR-ASENTAMIENTO: los medios que cubren un asentamiento (los que lo listan en
// `coverage`). Agregar un asentamiento = darle su entrada en GAZETTEER y listarlo en el `coverage`
// de al menos un medio; el scraper no cambia. Devuelve [] si nadie lo cubre.
export function sourcesForSettlement(settlementId) {
  return SOURCES.filter((s) => s.coverage.includes(settlementId));
}

// Asentamientos con al menos un medio que los cubre (universo scrapeable de esta fase).
export function coveredSettlements() {
  return Object.keys(GAZETTEER).filter((id) => sourcesForSettlement(id).length > 0);
}

// --- Capa 2: metadatos CITABLES del <head> (nunca del cuerpo) ---
// Extrae el <head> de un HTML (para poder abortar la descarga en </head> aguas arriba).
export function sliceHead(html) {
  const end = html.search(/<\/head>/i);
  return end === -1 ? html : html.slice(0, end);
}

function metaContent(head, matchers) {
  for (const re of matchers) {
    const m = head.match(re);
    if (m && m[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

// Decodifica entidades HTML comunes que aparecen en atributos content (&amp; &#39; &oacute; …).
function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…");
}

// Quita el "boilerplate" que el medio antepone a su asunto ("Estado de Veracruz | …",
// "Noticia estado-de-veracruz : …") para dejar el resumen limpio y citable.
function cleanSubject(text) {
  if (!text) return null;
  let s = text.replace(/^\s*Noticia\s+[a-z0-9-]+\s*:\s*/i, "").replace(/^[^|]{0,40}\|\s*/, "");
  s = s.replace(/\s+/g, " ").trim();
  // Colapsa la cola de truncamiento del medio ("… …", "... ...", "impu... ...") a una sola elipsis.
  s = s.replace(/(?:\s*(?:\.{3}|…)\s*){1,}$/u, "…").trim();
  return s || null;
}

// Quita el sufijo de marca del <title> ("… - xeu noticias veracruz", "… - Plumas Libres"). El
// patrón lo declara cada medio (source.brandRe); por defecto, XEU (compatibilidad con el test).
const DEFAULT_BRAND_RE = /\s*[-|–]\s*xeu\b.*$/i;
function cleanTitle(text, brandRe = DEFAULT_BRAND_RE) {
  if (!text) return null;
  return text.replace(brandRe, "").replace(/\s+/g, " ").trim() || null;
}

// Parsea SOLO metadatos declarados para indexación/cita: título real (og:title / <title>), asunto
// (og:description / meta description) y fecha de publicación. No toca el cuerpo. Devuelve null en los
// campos que el medio no declara (honesto: el llamador cae al título-desde-slug si no hay og:title).
export function parseHeadMetadata(html, brandRe = DEFAULT_BRAND_RE) {
  const head = sliceHead(html);
  const ogTitle = metaContent(head, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i
  ]);
  const rawTitle = metaContent(head, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
  const description = metaContent(head, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
  ]);
  const published = metaContent(head, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']article:published_time["']/i
  ]);

  return {
    title: cleanTitle(ogTitle || rawTitle, brandRe),
    subject: cleanSubject(description),
    publishedAt: published ? published.slice(0, 10) : null
  };
}

// Parsea una URL de XEU: https://xeu.mx/<seccion>/<id>/<slug>
export function parseArticleUrl(loc) {
  const match = loc.match(/^https?:\/\/(?:www\.)?xeu\.mx\/([a-z0-9-]+)\/(\d+)\/([a-z0-9-]+)/i);
  if (!match) return null;
  return { section: match[1].toLowerCase(), id: match[2], slug: match[3].toLowerCase() };
}

// Casos de prueba (#15): documentan el comportamiento esperado del matching por límites de token.
// NO corre en producción; útil para `node -e "import('./news-sources.mjs').then(m=>m.__selfTest())"`.
// Lanza si algún caso falla; devuelve el detalle de cada aserción.
export function __selfTest() {
  const results = [];
  const check = (name, ok) => {
    results.push({ name, ok });
    if (!ok) throw new Error(`__selfTest FALLÓ: ${name}`);
  };

  // "obra"⊂"obrador" NO debe clasificar como infraestructura (López Obrador).
  check(
    "lopez-obrador no es infraestructura",
    classifySignal("lopez-obrador-inaugura-libramiento")?.type !== "infraestructura"
  );
  // "fila"⊂"desfile" NO debe clasificar como movilidad.
  check("desfile no es movilidad", classifySignal("desfile-de-la-revolucion-en-el-centro")?.type !== "movilidad");
  // "calor"⊂"caloria" NO debe clasificar como clima.
  check("calorias no es clima", classifySignal("dieta-de-pocas-calorias-saludable")?.type !== "clima");

  // Positivos: token completo / prefijo de palabra sí pegan.
  check("gran-inundacion es inundacion", classifySignal("gran-inundacion-en-mocambo")?.type === "inundacion");
  check(
    "gran-inundacion-en-mocambo detecta colonia Mocambo",
    detectColonia("gran-inundacion-en-mocambo", "boca-del-rio")?.name === "Mocambo"
  );
  check(
    "obra (token completo) sí es infraestructura",
    classifySignal("obra-en-avenida-principal")?.type === "infraestructura"
  );

  // CP: la colonia detectada resuelve a su código postal semilla.
  check("Mocambo resuelve CP 94293", cpForColonia("boca-del-rio", "Mocambo") === "94293");
  check("CP de respaldo municipal existe", principalCp("veracruz") === "91700");

  return results;
}
