import type { UrbanLayerKey } from "@/config/urban-layers";

export type DataConfidence = "reported" | "curated" | "official" | "inferred";
export type DataPrivacy = "public" | "aggregated";
export type Severity = "low" | "medium" | "high";

export type UrbanMapSignal = {
  id: string;
  settlementId: string;
  city: string;
  layer: UrbanLayerKey;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: Severity;
  confidence: DataConfidence;
  source: string;
  sourceUrl?: string;
  observedAt: string;
  updatedAt: string;
  privacy: DataPrivacy;
  // Marca SEMILLA fabricada (demo de trazabilidad), no señal real; la UI la distingue de la evidencia.
  seed?: boolean;
  // Campos de señales periodísticas (opcionales): enfocar por CP y componer el dossier.
  postalCode?: string | null;
  colonia?: string | null;
  geoScope?: "punto" | "municipio" | "estado";
};

export type UrbanSignalWithMetadata<TMetadata = unknown> = UrbanMapSignal & {
  metadata?: TMetadata;
};

export type DataCompleteness = {
  complete: boolean;
  fetchedPages: number;
  failedPages: number;
  maxRecords: number;
  warning?: string;
};
