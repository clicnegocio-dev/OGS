export type DenueBusiness = {
  id: string;
  clee: string;
  name: string;
  businessName: string;
  activity: string;
  sectorId?: string;
  subsectorId?: string;
  branchId?: string;
  classId?: string;
  size: string;
  streetType: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  location: string;
  phone: string;
  email: string;
  website: string;
  establishmentType: string;
  lng: number;
  lat: number;
  mall?: string;
  mallType?: string;
  localNumber?: string;
  ageb?: string;
  block?: string;
  // Categoría cívica precomputada UNA sola vez al normalizar (NFD + regex es caro):
  // antes se recalculaba 3-4 veces por registro en cada cache miss.
  category?: DenueCategory;
};

type DenueRaw = string[] | Record<string, string | number | null | undefined>;

export function normalizeDenueRecord(raw: DenueRaw): DenueBusiness | null {
  if (Array.isArray(raw)) {
    const lng = Number(raw[17]);
    const lat = Number(raw[18]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const business: DenueBusiness = {
      clee: raw[0] || "",
      id: raw[1] || "",
      name: raw[2] || "",
      businessName: raw[3] || "",
      activity: raw[4] || "",
      size: raw[5] || "",
      streetType: raw[6] || "",
      street: raw[7] || "",
      exteriorNumber: raw[8] || "",
      interiorNumber: raw[9] || "",
      neighborhood: raw[10] || "",
      postalCode: raw[11] || "",
      location: raw[12] || "",
      phone: raw[13] || "",
      email: raw[14] || "",
      website: raw[15] || "",
      establishmentType: raw[16] || "",
      lng,
      lat,
      mall: raw[19],
      mallType: raw[20],
      localNumber: raw[21],
      ageb: raw[22],
      block: raw[23],
      classId: raw[25],
      sectorId: raw[26],
      subsectorId: raw[27],
      branchId: raw[28]
    };
    business.category = classifyDenueCategory(business);
    return business;
  }

  const lng = Number(raw.Longitud ?? raw.longitud ?? raw.lng);
  const lat = Number(raw.Latitud ?? raw.latitud ?? raw.lat);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const business: DenueBusiness = {
    clee: String(raw.CLEE ?? raw.clee ?? ""),
    id: String(raw.Id ?? raw.id ?? ""),
    name: String(raw.Nombre ?? raw.nombre ?? ""),
    businessName: String(raw.Razon_social ?? raw["Razón social"] ?? raw.razon_social ?? ""),
    activity: String(raw.Clase_actividad ?? raw["Clase de actividad"] ?? raw.clase_actividad ?? ""),
    size: String(raw.Estrato ?? raw.estrato ?? ""),
    streetType: String(raw.Tipo_vialidad ?? raw.tipo_vialidad ?? ""),
    street: String(raw.Calle ?? raw.calle ?? ""),
    exteriorNumber: String(raw.Num_Exterior ?? raw.numero_exterior ?? ""),
    interiorNumber: String(raw.Num_Interior ?? raw.numero_interior ?? ""),
    neighborhood: String(raw.Colonia ?? raw.colonia ?? ""),
    postalCode: String(raw.CP ?? raw.cp ?? ""),
    location: String(raw.Ubicacion ?? raw.ubicacion ?? ""),
    phone: String(raw.Telefono ?? raw.telefono ?? ""),
    email: String(raw.Correo_e ?? raw.email ?? ""),
    website: String(raw.Sitio_internet ?? raw.website ?? ""),
    establishmentType: String(raw.Tipo ?? raw.tipo ?? ""),
    lng,
    lat,
    ageb: raw.AGEB ? String(raw.AGEB) : undefined,
    block: raw.Manzana ? String(raw.Manzana) : undefined,
    classId: raw.Id_clase ? String(raw.Id_clase) : undefined,
    sectorId: raw.Id_sector ? String(raw.Id_sector) : undefined,
    subsectorId: raw.Id_subsector ? String(raw.Id_subsector) : undefined,
    branchId: raw.Id_rama ? String(raw.Id_rama) : undefined
  };
  business.category = classifyDenueCategory(business);
  return business;
}

// Quita acentos/diacríticos: DENUE devuelve texto acentuado ("educación"),
// así que comparar contra "educacion" sin normalizar fallaba siempre.
function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type DenueCategory = "salud" | "educacion" | "abasto" | "gobierno" | "comercio";

export function classifyDenueCategory(business: DenueBusiness): DenueCategory {
  // Reutiliza la categoría precomputada en normalizeDenueRecord (evita re-correr NFD+regex).
  if (business.category) return business.category;
  const text = normalizeText(`${business.activity} ${business.name}`);
  if (
    /(hospital|clinica|consultorio|farmacia|medic|salud|sanatorio|dentista|laboratorio clinico|centro de salud)/.test(
      text
    )
  )
    return "salud";
  if (
    /(escuela|educacion|colegio|universidad|preescolar|primaria|secundaria|kinder|jardin de ninos|bachillerato|instituto)/.test(
      text
    )
  )
    return "educacion";
  if (
    /(mercado|supermercado|abarrotes|tianguis|central de abasto|fruteria|verduleria|carniceria|tortilleria)/.test(text)
  )
    return "abasto";
  if (/(gobierno|municipal|administracion publica|ayuntamiento|dependencia oficial|oficina de gobierno)/.test(text))
    return "gobierno";
  return "comercio";
}

const CATEGORY_TO_LAYER: Record<DenueCategory, "social" | "institucional" | "economico"> = {
  salud: "social",
  educacion: "social",
  abasto: "economico",
  gobierno: "institucional",
  comercio: "economico"
};

export function classifyDenueLayer(business: DenueBusiness) {
  return CATEGORY_TO_LAYER[classifyDenueCategory(business)];
}

// Solo estas categorías ayudan a decidir habitabilidad; el resto se agrega como
// métrica (densidad comercial), no como miles de puntos idénticos que sepultan la evidencia.
const DECISION_RELEVANT: DenueCategory[] = ["salud", "educacion", "abasto", "gobierno"];

export function isDecisionRelevant(business: DenueBusiness) {
  return DECISION_RELEVANT.includes(classifyDenueCategory(business));
}

export const DENUE_CATEGORY_LABEL: Record<DenueCategory, string> = {
  salud: "Salud",
  educacion: "Educación",
  abasto: "Abasto",
  gobierno: "Gobierno",
  comercio: "Comercio"
};

// SEGURIDAD: la API de INEGI exige el token como ÚLTIMO SEGMENTO del path (no hay forma de
// pasarlo por header). Por eso estas URLs NUNCA deben loguearse ni incluirse en mensajes de error
// que viajen al cliente — quedarían en logs / Next Data Cache key. Trátalas como secreto.
export function buildDenueUrl({
  condition,
  lat,
  lng,
  distanceMeters,
  token
}: {
  condition: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  token: string;
}) {
  const safeCondition = encodeURIComponent(condition || "todos");
  return `https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/${safeCondition}/${lat},${lng}/${distanceMeters}/${token}`;
}

export function buildDenueAreaUrl({
  entityCode,
  municipalityCode,
  start,
  end,
  token,
  name = "0"
}: {
  entityCode: string;
  municipalityCode: string;
  start: number;
  end: number;
  token: string;
  name?: string;
}) {
  const safeName = encodeURIComponent(name || "0");
  return `https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarAreaAct/${entityCode}/${municipalityCode}/0/0/0/0/0/0/0/${safeName}/${start}/${end}/0/${token}`;
}
