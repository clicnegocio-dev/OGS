// Config del scraper de señales periodísticas (plano de LECTURA, efímero; ver scraping/README.md).
//
// CUMPLIMIENTO (principio del proyecto: respetar robots.txt y términos):
// - imagendeveracruz.mx → robots.txt: "User-agent: * / Disallow: /" (prohíbe bots genéricos y
//   no publica sitemap). NO se scrapea. Queda fuera hasta tener permiso/acuerdo explícito.
// - xeu.mx → bloquea "*" en /, pero PUBLICA sitemaps de noticias en su robots.txt. Solo
//   consumimos ese sitemap declarado: título (derivado del slug), URL, fecha y sección.
//   NUNCA descargamos el cuerpo del artículo. Almacenamos extracto+enlace, no la nota completa.
//
// Lo que producimos es una SEÑAL PERIODÍSTICA (confidence "reported"), nunca un hecho verificado.
//
// CÓDIGO POSTAL (esta fase): cada colonia del gazetteer lleva un `cp` APROXIMADO (semilla), y cada
// medio declara la `coverage` de municipios donde OPERA. De ahí derivamos POSTAL_INDEX: la vista
// "señales por código postal donde operan medios". La validación fina CP↔colonia (SEPOMEX / Marco
// Geoestadístico) es trabajo de OIS; aquí es semilla honesta, no domicilio.

export const SOURCES = [
  {
    id: "xeu",
    name: "XEU Noticias (medio)",
    sitemap: "https://www.xeu.mx/sitemaps/sitemap-noticias.xml",
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
    colonias: [
      { name: "Costa de Oro", keys: ["costa-de-oro"], lat: 19.1386, lng: -96.1086, cp: "94299" },
      { name: "Mocambo", keys: ["mocambo"], lat: 19.1297, lng: -96.1075, cp: "94293" },
      { name: "Boca del Río Centro", keys: ["centro-de-boca", "centro-historico-de-boca"], lat: 19.1056, lng: -96.1011, cp: "94290" },
      { name: "El Dorado", keys: ["el-dorado"], lat: 19.1208, lng: -96.119, cp: "94297" },
      { name: "Costa Verde", keys: ["costa-verde"], lat: 19.165, lng: -96.124, cp: "94294" },
      { name: "Floresta", keys: ["floresta"], lat: 19.158, lng: -96.13, cp: "94298" },
      { name: "Las Américas", keys: ["las-americas"], lat: 19.146, lng: -96.135, cp: "94298" },
      { name: "Ylang Ylang", keys: ["ylang-ylang", "ylang"], lat: 19.135, lng: -96.108, cp: "94293" },
      // Solo la clave específica: "riviera" suelto pegaba de pasada otras "riviera-*" (p.ej. Riviera Maya).
      { name: "Riviera Veracruzana", keys: ["riviera-veracruzana"], lat: 19.04, lng: -96.09, cp: "94277" },
      { name: "Fraccionamiento Reforma", keys: ["fraccionamiento-reforma"], lat: 19.15, lng: -96.12, cp: "94297" }
    ]
  },
  veracruz: {
    city: "Veracruz",
    center: { lat: 19.1903, lng: -96.1533 },
    principalCp: "91700",
    colonias: [
      { name: "Centro", keys: ["centro-de-veracruz", "centro-historico"], lat: 19.2003, lng: -96.1342, cp: "91700" },
      { name: "Reforma", keys: ["colonia-reforma"], lat: 19.183, lng: -96.14, cp: "91919" },
      { name: "Zaragoza", keys: ["zaragoza"], lat: 19.19, lng: -96.145, cp: "91910" },
      { name: "Playa Linda", keys: ["playa-linda"], lat: 19.17, lng: -96.13, cp: "91810" },
      { name: "Las Bajadas", keys: ["las-bajadas"], lat: 19.13, lng: -96.21, cp: "91697" },
      { name: "Pocitos y Rivera", keys: ["pocitos-y-rivera", "pocitos"], lat: 19.205, lng: -96.16, cp: "91775" },
      { name: "Río Medio", keys: ["rio-medio"], lat: 19.18, lng: -96.19, cp: "91808" },
      { name: "Tarimoya", keys: ["tarimoya"], lat: 19.22, lng: -96.17, cp: "91775" },
      { name: "Formando Hogar", keys: ["formando-hogar"], lat: 19.18, lng: -96.16, cp: "91897" },
      { name: "Las Vegas", keys: ["las-vegas"], lat: 19.16, lng: -96.16, cp: "91868" }
    ]
  }
};

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
  { type: "clima", layer: "ambiental", severity: "medium", stems: ["lluvi", "tormenta", "ciclon", "huracan", "frente-frio", "el-norte", "calor", "granizo"] },
  { type: "accidente", layer: "urbano", severity: "high", stems: ["accidente", "choque", "atropell", "volcad", "derrap", "carambola"] },
  { type: "movilidad", layer: "urbano", severity: "medium", stems: ["trafico", "vial", "bloqueo", "cierre-de-", "fila", "embotell", "transporte"] },
  { type: "infraestructura", layer: "urbano", severity: "medium", stems: ["bache", "socavon", "obra", "baden", "puente", "drenaje", "banqueta", "alumbrado", "pavimentac"] },
  { type: "servicios", layer: "urbano", severity: "high", stems: ["sin-agua", "corte-de-agua", "desabasto", "fuga-de-agua", "apagon", "sin-luz", "fuga-de-gas", "cfe"] },
  { type: "inseguridad", layer: "institucional", severity: "high", stems: ["robo", "asalt", "balac", "homicid", "ejecut", "secuestr", "violenc", "narco", "extorsion", "feminicid", "disparos"] },
  { type: "gobierno", layer: "institucional", severity: "low", stems: ["alcald", "ayuntamiento", "gobernador", "edil", "regidor", "presupuesto", "obra-publica", "licitac"] },
  { type: "comercio", layer: "economico", severity: "low", stems: ["comercio", "negocio", "empleo", "inversion", "turism", "economi", "mercado"] },
  { type: "social", layer: "social", severity: "low", stems: ["manifestac", "marcha", "protesta", "vecinos", "comunidad", "colectiv"] }
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

// Reconstruye un título legible desde el slug ("lleg-el-dia" → "Lleg el dia"). Es aproximado
// (XEU ya removió acentos en el slug); sirve como extracto, con enlace a la nota original.
export function slugToTitle(slug) {
  const text = slug.replace(/-/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  check("obra (token completo) sí es infraestructura", classifySignal("obra-en-avenida-principal")?.type === "infraestructura");

  // CP: la colonia detectada resuelve a su código postal semilla.
  check("Mocambo resuelve CP 94293", cpForColonia("boca-del-rio", "Mocambo") === "94293");
  check("CP de respaldo municipal existe", principalCp("veracruz") === "91700");

  return results;
}
