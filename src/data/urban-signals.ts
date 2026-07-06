import type { DataConfidence, DataPrivacy, Severity } from "@/types/urban";

export type UrbanSignalLayer = "ambiental" | "urbano" | "social" | "economico" | "institucional";

export type UrbanSignal = {
  id: string;
  settlementId: string;
  city: string;
  layer: UrbanSignalLayer;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  // Uniones compartidas (antes re-inlineadas; ahora únicas en @/types/urban para no divergir).
  severity: Severity;
  confidence: DataConfidence;
  source: string;
  sourceUrl?: string;
  observedAt: string;
  updatedAt: string;
  privacy: DataPrivacy;
  // Estas entradas son SEMILLA fabricada (demo de trazabilidad), no reportes ciudadanos reales:
  // el flag permite que la UI las distinga/aísle de la evidencia genuina.
  seed?: boolean;
};

const SEED_SIGNALS: Omit<UrbanSignal, "seed">[] = [
  {
    id: "bdr-ambiental-001",
    settlementId: "boca-del-rio",
    city: "Boca del Río",
    layer: "ambiental",
    type: "inundacion",
    title: "Encharcamiento recurrente",
    description: "Zona marcada como señal inicial por la recurrencia de reportes ciudadanos de acumulación de agua.",
    lat: 19.1061,
    lng: -96.1064,
    severity: "high",
    confidence: "reported",
    source: "Radar ciudadano (semilla)",
    observedAt: "2026-06-27",
    updatedAt: "2026-06-27",
    privacy: "aggregated"
  },
  {
    id: "bdr-urbano-001",
    settlementId: "boca-del-rio",
    city: "Boca del Río",
    layer: "urbano",
    type: "movilidad",
    title: "Cruce peatonal conflictivo",
    description: "Punto de fricción entre flujo vehicular y peatonal; requiere verificación con observación local.",
    lat: 19.1098,
    lng: -96.1031,
    severity: "medium",
    confidence: "curated",
    source: "Inventario inicial Ecosistema Urbano",
    observedAt: "2026-06-27",
    updatedAt: "2026-06-27",
    privacy: "public"
  },
  {
    id: "bdr-social-001",
    settlementId: "boca-del-rio",
    city: "Boca del Río",
    layer: "social",
    type: "accesibilidad",
    title: "Banqueta con accesibilidad limitada",
    description:
      "Señal de espacio público que afecta la movilidad autónoma de adultos mayores, infancias y personas con discapacidad.",
    lat: 19.119,
    lng: -96.1115,
    severity: "medium",
    confidence: "reported",
    source: "Radar ciudadano (semilla)",
    observedAt: "2026-06-27",
    updatedAt: "2026-06-27",
    privacy: "aggregated"
  },
  {
    id: "bdr-economico-001",
    settlementId: "boca-del-rio",
    city: "Boca del Río",
    layer: "economico",
    type: "comercio",
    title: "Zona con baja vitalidad comercial",
    description:
      "Señal preliminar para observar el cierre de locales, el flujo peatonal y los cambios de actividad económica.",
    lat: 19.1124,
    lng: -96.1202,
    severity: "low",
    confidence: "inferred",
    source: "Hipótesis editorial Ecosistema Urbano",
    observedAt: "2026-06-27",
    updatedAt: "2026-06-27",
    privacy: "public"
  },
  {
    id: "bdr-institucional-001",
    settlementId: "boca-del-rio",
    city: "Boca del Río",
    layer: "institucional",
    type: "mantenimiento",
    title: "Seguimiento pendiente",
    description: "Punto usado para demostrar trazabilidad: reporte, confirmación, respuesta y cierre.",
    lat: 19.1012,
    lng: -96.117,
    severity: "medium",
    confidence: "reported",
    source: "Radar ciudadano (semilla)",
    observedAt: "2026-06-27",
    updatedAt: "2026-06-27",
    privacy: "aggregated"
  }
];

// Marca explícita seed:true en todas: el origen ("semilla"/"Inventario inicial"/"Hipótesis editorial")
// ya viaja en `source`, pero el flag lo hace inequívoco para el cliente.
export const urbanSignals: UrbanSignal[] = SEED_SIGNALS.map((signal) => ({ ...signal, seed: true }));
