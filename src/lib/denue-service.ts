import { getSettlement, type Settlement } from "@/config/settlements";
import { cached } from "@/lib/cache";
import {
  buildDenueAreaUrl,
  buildDenueUrl,
  classifyDenueCategory,
  classifyDenueLayer,
  isDecisionRelevant,
  normalizeDenueRecord,
  type DenueBusiness,
  type DenueCategory
} from "@/lib/denue";
import type { DataCompleteness, UrbanMapSignal, UrbanSignalWithMetadata } from "@/types/urban";

const DENUE_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_RECORDS = 50000;
// Presupuesto para el caso INTERACTIVO (request en serverless). Antes el barrido podía encadenar
// hasta 50 fetch de 20s (~16 min) y matar la función. Ahora el GUARDIÁN DURO es el tiempo total
// (~15s, muy por debajo de los ~16 min previos); MAX_PAGES es un techo secundario alto para que
// los municipios insignia (Boca ~10 págs) completen cuando la red coopera, y degraden a parcial+
// warning si no. El barrido exhaustivo de municipios enormes es trabajo OFFLINE (OIS).
const MAX_PAGES = 15;
const PAGE_TIMEOUT_MS = 7000;
const TOTAL_BUDGET_MS = 15000;

export type DenueDataset = {
  settlement: Settlement;
  businesses: DenueBusiness[];
  completeness: DataCompleteness;
  source: "INEGI DENUE API";
  timestamp: string;
};

export async function getDenueDataset({
  settlementId,
  condition = "todos",
  mode = "area",
  lat,
  lng,
  distanceMeters
}: {
  settlementId?: string;
  condition?: string;
  mode?: "area" | "radius";
  lat?: number;
  lng?: number;
  distanceMeters?: number;
}) {
  const token = process.env.DENUE_TOKEN;
  if (!token) throw new Error("DENUE_TOKEN is not configured");

  const normalizedCondition = condition || "todos";
  const settlement = getSettlement(settlementId || "boca-del-rio");
  // En modo "area" el resultado depende SOLO de (settlement, condition): lat/lng/distance no
  // afectan, así que omitirlos de la clave evita polución del cache (cardinalidad 1 por par).
  const cacheKey =
    mode === "area"
      ? ["denue-dataset", "area", settlement.id, normalizedCondition].join(":")
      : ["denue-dataset", "radius", settlement.id, normalizedCondition, lat ?? "na", lng ?? "na", distanceMeters ?? "na"].join(":");

  return cached<DenueDataset>(
    cacheKey,
    DENUE_TTL_MS,
    async () => {
      const result =
        mode === "area"
          ? await fetchAreaDataset({ settlement, token, condition: normalizedCondition })
          : await fetchRadiusDataset({
              settlement,
              token,
              condition: normalizedCondition,
              lat: lat ?? settlement.center.lat,
              lng: lng ?? settlement.center.lng,
              distanceMeters: distanceMeters ?? 2500
            });

      return {
        settlement,
        businesses: result.businesses,
        completeness: result.completeness,
        source: "INEGI DENUE API",
        timestamp: new Date().toISOString()
      };
    },
    // No persistir 24h un dataset VACÍO producto de un fallo upstream (envenenaría el cache con "0").
    // Un dataset parcial pero con datos reales sí se cachea (es evidencia válida, solo incompleta).
    { shouldCache: (dataset) => dataset.businesses.length > 0 }
  );
}

// Vintage del corte DENUE (INEGI lo publica ~2 veces al año). observedAt refleja la
// antigüedad real del dato; updatedAt refleja cuándo lo refrescamos nosotros. No fingimos "hoy".
// TODO: leer el corte real desde la respuesta INEGI cuando esté disponible.
const DENUE_VINTAGE = "2024-11";

function businessToSignal(business: DenueBusiness, dataset: DenueDataset, fetchedAt: string): UrbanMapSignal {
  return {
    id: `denue-${business.id}`,
    settlementId: dataset.settlement.id,
    city: dataset.settlement.name,
    layer: classifyDenueLayer(business),
    type: classifyDenueCategory(business),
    title: business.name || business.businessName || "Establecimiento",
    description: business.activity || "Actividad económica registrada por DENUE.",
    lat: business.lat,
    lng: business.lng,
    severity: "low",
    confidence: "official",
    source: "INEGI DENUE",
    observedAt: DENUE_VINTAGE,
    updatedAt: fetchedAt,
    privacy: "public"
  };
}

export function denueToMapSignals(dataset: DenueDataset): UrbanMapSignal[] {
  const fetchedAt = dataset.timestamp.slice(0, 10);

  // Solo categorías que informan una decisión de habitabilidad (salud, educación, abasto,
  // gobierno). El comercio genérico se agrega como métrica, no como miles de puntos idénticos.
  return dataset.businesses.filter(isDecisionRelevant).map((business) => businessToSignal(business, dataset, fetchedAt));
}

export function denueToFullSignals(dataset: DenueDataset): UrbanSignalWithMetadata<DenueBusiness>[] {
  // Una sola pasada: filtra una vez y empareja señal+metadata en el mismo recorrido, en vez de
  // depender de que dos filtros independientes produzcan idéntico orden/longitud (era frágil).
  const fetchedAt = dataset.timestamp.slice(0, 10);
  return dataset.businesses
    .filter(isDecisionRelevant)
    .map((business) => ({ ...businessToSignal(business, dataset, fetchedAt), metadata: business }));
}

export function summarizeDenue(dataset: DenueDataset) {
  const byCategory: Record<DenueCategory, number> = {
    salud: 0,
    educacion: 0,
    abasto: 0,
    gobierno: 0,
    comercio: 0
  };
  for (const business of dataset.businesses) byCategory[classifyDenueCategory(business)] += 1;
  const essentialServices = byCategory.salud + byCategory.educacion + byCategory.abasto;
  return { total: dataset.businesses.length, essentialServices, byCategory };
}

async function fetchAreaDataset({ settlement, token, condition }: { settlement: Settlement; token: string; condition: string }) {
  if (!settlement.inegi) {
    return {
      businesses: [],
      completeness: buildCompleteness({ complete: false, fetchedPages: 0, failedPages: 0, warning: "Settlement has no INEGI area configured." })
    };
  }

  const businesses: DenueBusiness[] = [];
  let fetchedPages = 0;
  let failedPages = 0;
  let complete = true;
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE + 1;
    const end = start + PAGE_SIZE - 1;

    // Presupuesto global: nunca encadenamos más allá de TOTAL_BUDGET_MS aunque queden páginas.
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      complete = false;
      break;
    }

    const url = buildDenueAreaUrl({
      entityCode: settlement.inegi.entityCode,
      municipalityCode: settlement.inegi.municipalityCode,
      start,
      end,
      token,
      name: condition === "todos" ? "0" : condition
    });

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(PAGE_TIMEOUT_MS, remaining)),
        next: { revalidate: 86400 }
      });
    } catch {
      // Timeout/red en una página: cortamos y devolvemos lo que haya con warning (no lanzamos).
      failedPages += 1;
      complete = false;
      break;
    }

    if (!response.ok) {
      failedPages += 1;
      complete = false;
      break;
    }

    fetchedPages += 1;
    // Corte por longitud CRUDA, no filtrada: normalizeDenueList descarta registros sin coords,
    // así que comparar la longitud ya filtrada contra PAGE_SIZE truncaba en silencio el barrido.
    const raw = await response.json();
    const rawLength = Array.isArray(raw) ? raw.length : 0;
    businesses.push(...normalizeDenueList(raw));
    if (rawLength < PAGE_SIZE) break; // última página real
    if (page === MAX_PAGES - 1) complete = false; // tope de páginas alcanzado con datos restantes
  }

  return {
    businesses,
    completeness: buildCompleteness({
      complete,
      fetchedPages,
      failedPages,
      warning: complete
        ? undefined
        : "Resultados DENUE posiblemente parciales: se alcanzó el límite de páginas/tiempo o hubo un error upstream."
    })
  };
}

async function fetchRadiusDataset({
  settlement,
  token,
  condition,
  lat,
  lng,
  distanceMeters
}: {
  settlement: Settlement;
  token: string;
  condition: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}) {
  const url = buildDenueUrl({ condition, lat, lng, distanceMeters, token });

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 }
    });
  } catch {
    // Timeout/red: degrada honestamente (no lanza). El mensaje NO incluye la URL (lleva el token).
    return {
      businesses: [],
      completeness: buildCompleteness({
        complete: false,
        fetchedPages: 0,
        failedPages: 1,
        warning: `La consulta DENUE por radio para ${settlement.id} no respondió a tiempo.`
      })
    };
  }

  if (!response.ok) {
    return {
      businesses: [],
      completeness: buildCompleteness({
        complete: false,
        fetchedPages: 0,
        failedPages: 1,
        warning: `La consulta DENUE por radio para ${settlement.id} falló (HTTP ${response.status}).`
      })
    };
  }

  return {
    businesses: normalizeDenueList(await response.json()),
    completeness: buildCompleteness({ complete: true, fetchedPages: 1, failedPages: 0 })
  };
}

function normalizeDenueList(raw: unknown) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => normalizeDenueRecord(item as Parameters<typeof normalizeDenueRecord>[0]))
    .filter((business): business is DenueBusiness => business !== null);
}

function buildCompleteness({
  complete,
  fetchedPages,
  failedPages,
  warning
}: {
  complete: boolean;
  fetchedPages: number;
  failedPages: number;
  warning?: string;
}): DataCompleteness {
  return {
    complete,
    fetchedPages,
    failedPages,
    maxRecords: MAX_RECORDS,
    warning
  };
}
