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
  // Asunto citable tomado del <head> del medio (og:description). null si aún no se enriqueció.
  subject?: string | null;
  enriched?: boolean;
};

export type SourceFreshness = { count: number; maxObservedAt: string | null };

export type NewsMeta = {
  vintage: string;
  generatedAt: string;
  source: string;
  note: string;
  // Frescura por fuente (#C2): un sitemap rezagado no se esconde tras el vintage global.
  bySource: Record<string, SourceFreshness>;
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
  note: newsData.note,
  bySource: (newsData as { bySource?: Record<string, SourceFreshness> }).bySource ?? {}
};

// Días entre una fecha "YYYY-MM-DD"/ISO y `nowMs` (inyectado: la UI pasa Date.now(); mantiene puro el
// server). null si la fecha es inválida. Base del aviso de rezago del tablero.
export function daysSince(dateIso: string | null | undefined, nowMs: number): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000));
}

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
export function countBy(
  signals: NewsSignal[],
  get: (s: NewsSignal) => string | null | undefined
): Record<string, number> {
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
  subject: string | null;
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
    subject: s.subject ?? null, // asunto citable (og:description); null si aún no se enriqueció
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

// Ventana temporal para considerar que dos notas hablan del MISMO evento (no de dos hechos distintos).
const EVENT_WINDOW_MS = 7 * 86_400_000;

// Normaliza un título para detectar republicaciones casi idénticas (misma nota, otra URL): minúsculas,
// sin acentos, solo alfanumérico. "Reportan mega bache…" y "REPORTAN MEGA BACHE…" colapsan a una.
function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Colapsa republicaciones del MISMO medio con título casi idéntico → una sola mención (antes inflaban
// `mentions` y hacían subir la recurrencia con la misma nota repetida).
function dedupeReports(items: CpDossierItem[]): CpDossierItem[] {
  const seen = new Set<string>();
  const out: CpDossierItem[] = [];
  for (const item of items) {
    const key = `${item.source ?? "?"}|${normalizeTitle(item.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Agrupa un conjunto (ya del mismo CP) en EVENTOS: mismo tipo y fechas dentro de EVENT_WINDOW_MS. Las
// notas sin fecha no pueden probar "mismo evento" → cada una es un evento aislado (conservador).
function clusterEvents(items: CpDossierItem[]): CpDossierItem[][] {
  const dated = items
    .map((item) => ({ item, t: dayMs(item.observedAt) }))
    .filter((x): x is { item: CpDossierItem; t: number } => x.t != null)
    .sort((a, b) => a.t - b.t);

  const clusters: CpDossierItem[][] = [];
  const openByType = new Map<string, { lastT: number; items: CpDossierItem[] }>();
  for (const { item, t } of dated) {
    const open = openByType.get(item.type);
    if (open && t - open.lastT <= EVENT_WINDOW_MS) {
      open.items.push(item);
      open.lastT = t; // cadena temporal: la ventana se mide contra la última nota vista del evento
    } else {
      const fresh = { lastT: t, items: [item] };
      openByType.set(item.type, fresh);
      clusters.push(fresh.items);
    }
  }
  for (const item of items) if (dayMs(item.observedAt) == null) clusters.push([item]);
  return clusters;
}

// Deriva la confianza de un grupo de señales del mismo CP. La CORROBORACIÓN (4/4) exige ≥2 medios sobre
// el MISMO evento (misma ventana temporal), no la mera coexistencia de dos medios en el CP a lo largo de
// meses. La RECURRENCIA cuenta EVENTOS distintos (deduplicando republicaciones), no notas repetidas.
function confidenceOf(rawItems: CpDossierItem[]): Confidence {
  const items = dedupeReports(rawItems);
  const events = clusterEvents(items);

  let maxSourcesPerEvent = 1;
  for (const event of events) {
    const sources = new Set(event.map((i) => i.source).filter((s): s is string => Boolean(s)));
    if (sources.size > maxSourcesPerEvent) maxSourcesPerEvent = sources.size;
  }

  const times = items.map((i) => dayMs(i.observedAt)).filter((t): t is number => t != null);
  return assessConfidence({
    mentions: events.length, // recurrencia = eventos distintos, no republicaciones
    distinctSources: maxSourcesPerEvent, // corroboración = medios sobre el mismo evento
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
    .map((item) => ({
      id: item.id,
      title: item.title,
      observedAt: item.observedAt ?? null,
      sourceUrl: item.sourceUrl ?? null
    }));

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
