// Registro de fuentes de datos de Ecosistema Urbano — transparencia por diseño (Principio 1) y datos
// comprensibles (Principio 4). Alimenta la página /fuentes. Declara honestamente qué aporta cada
// fuente, su acceso, frescura, confianza y ESTADO (en vivo / semilla / construido-sin-cablear / OIS).

export type SourceStatus = "vivo" | "snapshot" | "semilla" | "desconectado" | "ois";
export type SourceConfidence = "official" | "reported" | "curated" | "inferred";

export type DataSource = {
  id: string;
  name: string;
  provider: string;
  gives: string;
  layers: string;
  access: string;
  freshness: string;
  confidence: SourceConfidence;
  status: SourceStatus;
  url?: string;
  note?: string;
};

export const STATUS_META: Record<SourceStatus, { label: string; description: string; color: string }> = {
  vivo: { label: "En vivo", description: "Se consume en tiempo real y alimenta la interfaz.", color: "#6bae6e" },
  snapshot: { label: "Instantánea cableada", description: "Dato real con fecha de corte, servido desde un snapshot (no en tiempo real).", color: "#4a90c4" },
  semilla: { label: "Semilla / demo", description: "Datos fabricados para ilustrar; marcados como demo.", color: "#e0a23a" },
  desconectado: { label: "Construido, sin cablear", description: "El conector existe pero aún no llega a la interfaz.", color: "#8a8f98" },
  ois: { label: "En integración (OIS)", description: "Requiere ingestión pesada / persistencia: es trabajo de OIS (Fase 2).", color: "#4c6fae" }
};

export const CONFIDENCE_META: Record<SourceConfidence, string> = {
  official: "Dato oficial",
  reported: "Reporte (medio / ciudadano), no verificado",
  curated: "Inventario curado",
  inferred: "Inferencia / hipótesis"
};

export const STATUS_ORDER: SourceStatus[] = ["vivo", "snapshot", "semilla", "desconectado", "ois"];

export const DATA_SOURCES: DataSource[] = [
  {
    id: "open-meteo",
    name: "Open-Meteo",
    provider: "Open-Meteo",
    gives: "Clima, lluvia, calor y calidad del aire (AQI).",
    layers: "Ambiental · Riesgo",
    access: "API pública (sin token)",
    freshness: "En vivo (pronóstico 24 h)",
    confidence: "official",
    status: "vivo",
    url: "https://open-meteo.com",
    note: "El riesgo hídrico local se deriva de aquí."
  },
  {
    id: "usgs-eonet",
    name: "USGS · NASA EONET",
    provider: "USGS / NASA",
    gives: "Sismos y eventos ambientales (incendios, volcanes).",
    layers: "Riesgo",
    access: "API pública (sin token)",
    freshness: "En vivo",
    confidence: "official",
    status: "vivo",
    url: "https://earthquake.usgs.gov",
    note: "Radio amplio como contexto regional; 'sin eventos' ≠ 'sin riesgo'."
  },
  {
    id: "denue",
    name: "INEGI DENUE",
    provider: "INEGI",
    gives: "Establecimientos y servicios (comercio, equipamiento).",
    layers: "Económico · Social · Institucional",
    access: "API oficial (con token)",
    freshness: "Corte semestral INEGI",
    confidence: "official",
    status: "vivo",
    url: "https://www.inegi.org.mx/servicios/api_denue.html",
    note: "El límite del municipio se aproxima con estos puntos (no es el jurídico)."
  },
  {
    id: "datamexico",
    name: "DataMéxico",
    provider: "Secretaría de Economía · INEGI · CONEVAL",
    gives: "Perfil socioeconómico: población, pobreza, internet en casa, inseguridad (ENVIPE).",
    layers: "Dossier · Social",
    access: "API pública (Tesseract OLAP)",
    freshness: "Por corte oficial (vintage por métrica)",
    confidence: "official",
    status: "vivo",
    url: "https://www.economia.gob.mx/datamexico",
    note: "Granularidad municipio; el detalle por AGEB/colonia llega con OIS."
  },
  {
    id: "xeu-news",
    name: "XEU Noticias",
    provider: "XEU (medio local)",
    gives: "Señales periodísticas por asentamiento y código postal.",
    layers: "Varias",
    access: "Sitemap declarado (respeta robots.txt; no descarga cuerpos)",
    freshness: "Snapshot (corte 2025-08-02); se regenera con el scraper",
    confidence: "reported",
    status: "snapshot",
    url: "https://xeu.mx",
    note: "Reportes de medios, no hechos verificados. CP aproximado (semilla). Plano de lectura, efímero."
  },
  {
    id: "seeds",
    name: "Semillas de demostración",
    provider: "Ecosistema Urbano",
    gives: "5 señales fabricadas que ilustran la trazabilidad (reporte→respuesta→cierre).",
    layers: "Varias",
    access: "Dataset interno",
    freshness: "Estáticas",
    confidence: "curated",
    status: "semilla",
    note: "Marcadas 'Demo · señal semilla' en el mapa. No son evidencia real."
  },
  {
    id: "ckan-veracruz",
    name: "Datos Abiertos · Municipio de Veracruz (CKAN)",
    provider: "Ayuntamiento de Veracruz",
    gives: "Licencias, obras y padrón de proveedores (operación pública).",
    layers: "Institucional",
    access: "CKAN API",
    freshness: "Según el portal municipal",
    confidence: "official",
    status: "desconectado",
    url: "https://datos.veracruzmunicipio.gob.mx",
    note: "La semilla de 'operación pública' (rumbo OGS): el conector existe, aún sin cablear a la interfaz."
  },
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    provider: "Mercado Libre (API oficial)",
    gives: "Precio inmobiliario por municipio / código postal.",
    layers: "Económico",
    access: "API oficial (OAuth)",
    freshness: "En vivo con credencial",
    confidence: "curated",
    status: "desconectado",
    url: "https://developers.mercadolibre.com.mx",
    note: "Requiere credencial; sin ella degrada honesto (no se muestra)."
  },
  {
    id: "inegi-territorio",
    name: "INEGI Censo · Entorno Urbano · Marco Geoestadístico · CENAPRED",
    provider: "INEGI / CENAPRED / CONAGUA",
    gives: "Límites oficiales por AGEB, servicios básicos (drenaje/agua/luz), banquetas/alumbrado, inundación histórica.",
    layers: "Urbano · Social · Ambiental · Base",
    access: "Descargas / shapefiles / CSV (ingestión pesada)",
    freshness: "Cortes oficiales",
    confidence: "official",
    status: "ois",
    url: "https://www.inegi.org.mx/temas/mg/",
    note: "Requiere worker + base de datos: es trabajo de OIS (Fase 2), no del MVP."
  },
  {
    id: "reportes-ciudadanos",
    name: "Reportes ciudadanos",
    provider: "Ciudadanía → OIS",
    gives: "Señales que reporta la gente desde el formulario in-app.",
    layers: "Varias",
    access: "Puerta pública de OIS (POST /public/site/…/contact)",
    freshness: "En captura",
    confidence: "reported",
    status: "ois",
    note: "La captura ya va a OIS; releerlas y detectar patrones por zona es Fase 2 (OIS aún no expone la lectura)."
  }
];
