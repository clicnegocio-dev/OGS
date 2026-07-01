// Confianza por CORROBORACIÓN — honesto por diseño. La pregunta del ciudadano es "¿esto es real y qué
// tan seguros estamos?". No la respondemos afirmando; la DERIVAMOS (es una inferencia, no un dato) de
// cuánto se repite un fenómeno y —sobre todo— de cuántos MEDIOS INDEPENDIENTES coinciden.
//
// Realidad de hoy: todas las señales provienen de UN solo medio (XEU). Por eso lo honesto NO es
// "corroboración independiente" sino RECURRENCIA (un medio insiste). El tope (4/4) queda RESERVADO a
// corroboración real (≥2 medios): hoy inalcanzable, lo que señala con verdad que aún no la tenemos.
// Cuando EU sume otra fuente (u OIS devuelva reportes ciudadanos), esos grupos suben a "corroborada"
// SIN cambiar este código — el primitivo ya cuenta fuentes distintas. Nada aquí es "verificado":
// incluso corroborado sigue siendo reporte de medios, no hecho confirmado (doctrina anti-estigma).

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
