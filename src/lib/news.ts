import { SETTLEMENTS } from "@/config/settlements";
import type { UrbanMapSignal } from "@/types/urban";
import { assessConfidence, type Confidence } from "@/lib/confidence";
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
  source: string | null;
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
    source: s.source ?? null, // para derivar confianza (medios distintos) idéntico al mapa
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
  source?: string | null; // medio que lo reporta; base de la confianza por corroboración
  observedAt?: string | null;
  sourceUrl?: string | null;
  colonia?: string | null;
  postalCode?: string | null;
};

export type DossierTypeStat = { type: string; layer: string; count: number; confidence: Confidence };

// Fecha "YYYY-MM-DD" → epoch ms (o null). Determinista (no usa "ahora"): la confianza depende solo de
// los datos, para que SSG y tests sean reproducibles.
function dayMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value.slice(0, 10));
  return Number.isNaN(t) ? null : t;
}

function spanDays(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, (max - min) / 86_400_000);
}

// Deriva la confianza de un grupo de señales (menciones + medios distintos + lapso temporal).
function confidenceOf(items: CpDossierItem[]): Confidence {
  const sources = new Set(items.map((i) => i.source).filter((s): s is string => Boolean(s)));
  const times = items.map((i) => dayMs(i.observedAt)).filter((t): t is number => t != null);
  return assessConfidence({
    mentions: items.length,
    distinctSources: sources.size || 1,
    daysSpan: times.length ? spanDays(Math.min(...times), Math.max(...times)) : 0
  });
}

export function buildCpDossier(items: CpDossierItem[], cp: string | null) {
  if (!cp) return null;
  const cpItems = items.filter((i) => i.postalCode === cp);
  if (cpItems.length === 0) return null;
  const colonia = cpItems.find((i) => i.colonia)?.colonia ?? null;

  const groups = new Map<string, CpDossierItem[]>();
  for (const item of cpItems) {
    const bucket = groups.get(item.type);
    if (bucket) bucket.push(item);
    else groups.set(item.type, [item]);
  }
  const byType: DossierTypeStat[] = [...groups.entries()]
    .map(([type, group]) => ({ type, layer: group[0].layer, count: group.length, confidence: confidenceOf(group) }))
    .sort((a, b) => b.count - a.count);

  const recent = [...cpItems]
    .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""))
    .slice(0, 4)
    .map((item) => ({ id: item.id, title: item.title, observedAt: item.observedAt ?? null, sourceUrl: item.sourceUrl ?? null }));

  // Confianza global del CP (todas sus señales, sin separar por tipo): la del encabezado del dossier.
  return { cp, colonia, total: cpItems.length, confidence: confidenceOf(cpItems), byType, recent };
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
