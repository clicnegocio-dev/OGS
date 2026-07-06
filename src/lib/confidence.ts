// Confianza por CORROBORACIÓN — honesto por diseño. La pregunta del ciudadano es "¿esto es real y qué
// tan seguros estamos?". No la respondemos afirmando; la DERIVAMOS (es una inferencia, no un dato) de
// cuánto se repite un fenómeno y —sobre todo— de cuántos MEDIOS INDEPENDIENTES coinciden.
//
// Realidad de hoy: hay VARIOS medios (XEU, Plumas Libres, El Dictamen), así que "corroborada" (4/4) ya
// es alcanzable. PERO corroborar de verdad es ≥2 medios sobre el MISMO evento, no dos medios que por
// separado tocaron ese CP+tipo a lo largo de meses. Esa distinción NO vive aquí (este primitivo solo
// recibe números): la impone `confidenceOf` en lib/news.ts agrupando por EVENTO (ventana temporal) y
// deduplicando republicaciones antes de contar fuentes/menciones. Aquí solo mapeamos esos números al
// medidor. Nada es "verificado": incluso corroborado sigue siendo reporte de medios (doctrina anti-estigma).

export type ConfidenceLevel = "aislada" | "emergente" | "recurrente" | "corroborada";

export type Confidence = {
  level: ConfidenceLevel;
  dots: number; // 1..4, para el medidor ●●●○ (el 4.º exige medios independientes)
  label: string; // etiqueta corta y honesta
  basis: string; // en qué se basa (recurrencia de N notas / corroboración de N medios)
  corroborated: boolean; // ≥2 fuentes independientes coinciden
};

export type ConfidenceInput = {
  mentions: number; // total de notas del grupo (mismo CP + mismo tipo, p. ej.)
  distinctSources: number; // medios distintos que lo reportan
  daysSpan: number; // días entre la primera y la última nota (0 si es una sola)
};

export const MAX_DOTS = 4;

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function spanText(days: number): string {
  const d = Math.round(days);
  return d >= 1 ? ` en ${d} ${plural(d, "día", "días")}` : "";
}

export function assessConfidence({ mentions, distinctSources, daysSpan }: ConfidenceInput): Confidence {
  const n = Math.max(0, Math.floor(mentions));
  const sources = Math.max(1, Math.floor(distinctSources));
  const span = Math.max(0, daysSpan);

  // Único camino al tope (4/4): CORROBORACIÓN por medios independientes. No alcanzable con una fuente.
  if (sources >= 2) {
    return {
      level: "corroborada",
      dots: MAX_DOTS,
      label: "Corroborada",
      basis: `${n} ${plural(n, "nota", "notas")} de ${sources} medios independientes${spanText(span)}`,
      corroborated: true
    };
  }

  // Un solo medio: la confianza viene de la RECURRENCIA, con tope 3/4 (no es verificación).
  if (n <= 1) {
    return {
      level: "aislada",
      dots: 1,
      label: "Señal aislada",
      basis: "1 nota de un solo medio · sin verificar",
      corroborated: false
    };
  }
  if (n === 2) {
    return {
      level: "emergente",
      dots: 2,
      label: "Señal emergente",
      basis: `2 notas del mismo medio${spanText(span)}`,
      corroborated: false
    };
  }
  return {
    level: "recurrente",
    dots: 3,
    label: "Patrón recurrente",
    basis: `${n} notas del mismo medio${spanText(span)} · no es corroboración independiente`,
    corroborated: false
  };
}
