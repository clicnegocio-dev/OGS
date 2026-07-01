import { SETTLEMENTS } from "@/config/settlements";
import type { UrbanMapSignal } from "@/types/urban";
import newsData from "@scraping/news/output/news-signals.generated.json";

// Carga y scoping de las señales periodísticas (plano de LECTURA, efímero; ver scraping/README.md).
// Compartido por la API (/api/urban/news) y por la vista de lista (/[settlement]/noticias) para que
// la atribución en 3 niveles sea idéntica en ambas.

export type GeoScope = "punto" | "municipio" | "estado";

export type NewsSignal = UrbanMapSignal & {
  section: string;
  colonia: string | null;
  postalCode?: string | null;
  stateCode?: string | null;
  geoScope: GeoScope;
};

export type NewsMeta = {
  vintage: string;
  generatedAt: string;
  source: string;
  note: string;
};

function isValidNewsSignal(value: unknown): value is NewsSignal {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.layer === "string" &&
    Number.isFinite(s.lat) &&
    Number.isFinite(s.lng) &&
    (s.geoScope === "punto" || s.geoScope === "municipio" || s.geoScope === "estado")
  );
}

const RAW_SIGNALS: unknown[] = Array.isArray(newsData.signals) ? (newsData.signals as unknown[]) : [];
export const ALL_NEWS: NewsSignal[] = RAW_SIGNALS.filter(isValidNewsSignal);

export const NEWS_META: NewsMeta = {
  vintage: newsData.vintage,
  generatedAt: newsData.generatedAt,
  source: newsData.source,
  note: newsData.note
};

// "Ver todo" de un asentamiento: sus señales de PUNTO y MUNICIPIO, MÁS las de nivel ESTADO de su
// estado (clave INEGI). Sin settlement → todo el dataset.
export function scopeNews(settlement: string | null): NewsSignal[] {
  if (!settlement) return ALL_NEWS;
  const stateCode = SETTLEMENTS[settlement]?.inegi?.entityCode;
  return ALL_NEWS.filter(
    (s) => s.settlementId === settlement || (s.geoScope === "estado" && s.stateCode === stateCode)
  );
}

// Cuenta por una llave string de la señal (tipo, nivel geográfico, o CP donde operan los medios).
export function countBy(signals: NewsSignal[], get: (s: NewsSignal) => string | null | undefined): Record<string, number> {
  return signals.reduce<Record<string, number>>((acc, signal) => {
    const value = get(signal);
    if (value) acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

// Fila ligera para la vista de lista (evita serializar campos no usados, p.ej. la descripción larga).
export type BoardRow = {
  id: string;
  type: string;
  layer: string;
  title: string;
  sourceUrl: string | null;
  observedAt: string | null;
  colonia: string | null;
  postalCode: string | null;
  geoScope: GeoScope;
};

export function toBoardRows(signals: NewsSignal[]): BoardRow[] {
  return signals.map((s) => ({
    id: s.id,
    type: s.type,
    layer: s.layer,
    title: s.title,
    sourceUrl: s.sourceUrl ?? null,
    observedAt: s.observedAt ?? null,
    colonia: s.colonia ?? null,
    postalCode: s.postalCode ?? null,
    geoScope: s.geoScope
  }));
}

// Dossier por CP: síntesis única (colonia, desglose por tipo, últimas) usada IDÉNTICAMENTE por el mapa
// (UrbanHero, sobre UrbanMapSignal[]) y el tablero (NewsBoard, sobre BoardRow[]). Antes duplicada.
export type CpDossierItem = {
  id: string;
  type: string;
  layer: string;
  title: string;
  observedAt?: string | null;
  sourceUrl?: string | null;
  colonia?: string | null;
  postalCode?: string | null;
};

export function buildCpDossier(items: CpDossierItem[], cp: string | null) {
  if (!cp) return null;
  const cpItems = items.filter((i) => i.postalCode === cp);
  if (cpItems.length === 0) return null;
  const colonia = cpItems.find((i) => i.colonia)?.colonia ?? null;
  const counts = new Map<string, { layer: string; count: number }>();
  for (const item of cpItems) {
    const entry = counts.get(item.type) ?? { layer: item.layer, count: 0 };
    entry.count += 1;
    counts.set(item.type, entry);
  }
  const byType = [...counts.entries()]
    .map(([type, v]) => ({ type, layer: v.layer, count: v.count }))
    .sort((a, b) => b.count - a.count);
  const recent = [...cpItems]
    .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""))
    .slice(0, 4)
    .map((item) => ({ id: item.id, title: item.title, observedAt: item.observedAt ?? null, sourceUrl: item.sourceUrl ?? null }));
  return { cp, colonia, total: cpItems.length, byType, recent };
}

// Índice compacto (asentamiento, CP, colonia) para el buscador ⌘K — evita serializar todo el dataset.
export function postalCommandIndex(): { settlementId: string; cp: string; colonia: string | null }[] {
  const seen = new Map<string, { settlementId: string; cp: string; colonia: string | null }>();
  for (const s of ALL_NEWS) {
    if (!s.settlementId || !s.postalCode) continue;
    const key = `${s.settlementId}:${s.postalCode}`;
    const existing = seen.get(key);
    if (!existing) seen.set(key, { settlementId: s.settlementId, cp: s.postalCode, colonia: s.colonia });
    else if (!existing.colonia && s.colonia) existing.colonia = s.colonia; // prefiere una colonia con nombre
  }
  return [...seen.values()];
}
