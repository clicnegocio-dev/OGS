// Perfil socioeconómico municipal estructurado por las 4 dimensiones de análisis.
// Fuente: cubos oficiales de DataMéxico (INEGI población + CONEVAL pobreza/carencias).
// Esta es la primera evidencia oficial agregada que cruza capas: convierte la tesis
// "nada está aislado" en dato medido, no narrado.
//
// Honestidad (principio #1 del proyecto): cada métrica declara fuente, vintage y confianza.
// La dimensión predictiva aquí es TENDENCIA OBSERVADA (2010→2020), no proyección modelada;
// se marca explícitamente para no sobreprometer. La prescriptiva es una señal de prioridad
// explicable, no una recomendación cerrada — eso exige el índice de decisión de OIS.

import { DATAMEXICO_SOURCE, fetchCube, num, type CubeRecord } from "@/lib/datamexico";
import { getSettlement } from "@/config/settlements";
import type { UrbanLayerKey } from "@/config/urban-layers";

export type ProfileMetric = {
  key: string;
  label: string;
  value: number;
  unit: "people" | "pct";
  year: number;
  layer: UrbanLayerKey;
};

export type DeprivationMetric = ProfileMetric & {
  // qué carencia pesa más explica el "por qué" de la zona.
  rank: number;
};

export type TrendPoint = { year: number; pct: number };

export type MunicipalProfile = {
  settlement: { id: string; name: string; inegiCode: string };
  source: { name: string; url: string; vintage: string };
  confidence: "official";
  // true si algún cubo de DataMéxico falló (no es lo mismo que "el municipio no tiene ese dato").
  // Permite a la UI distinguir "sin dato" de "fuente caída" sin degradar la confianza del dato sí obtenido.
  partial: boolean;
  dimensions: {
    // ¿Qué está pasando? — retrato actual de la zona.
    descriptive: {
      population: ProfileMetric | null;
      povertyRate: ProfileMetric | null;
      // Indicadores oficiales adicionales por capa (acceso digital, inseguridad percibida…).
      indicators: ProfileMetric[];
    };
    // ¿Por qué pasa? — desglose de carencias que explica las capas (servicios, salud, educación).
    diagnostic: {
      deprivations: DeprivationMetric[];
      dominant: DeprivationMetric | null;
    };
    // ¿Qué viene? — tendencia observada (no proyección modelada).
    predictive: {
      basis: string;
      povertyTrend: { series: TrendPoint[]; direction: "rising" | "falling" | "stable"; deltaPctPoints: number } | null;
    };
    // ¿Qué priorizar? — señal de prioridad explicable (no recomendación cerrada).
    prescriptive: {
      basis: string;
      priority: { signal: string; layer: UrbanLayerKey } | null;
    };
  };
};

const CONEVAL_DEPRIVATIONS: { measure: string; key: string; label: string; layer: UrbanLayerKey }[] = [
  {
    measure: "Deprivation Basic Services Housing",
    key: "servicios-basicos",
    label: "Carencia de servicios básicos en vivienda (agua, drenaje, luz)",
    layer: "urbano"
  },
  {
    measure: "Deprivation Health Services",
    key: "salud",
    label: "Carencia de acceso a servicios de salud",
    layer: "social"
  },
  { measure: "Educational Backwardness", key: "educacion", label: "Rezago educativo", layer: "social" },
  {
    measure: "Deprivation Quality Housing Spaces",
    key: "calidad-vivienda",
    label: "Carencia de calidad y espacios de la vivienda",
    layer: "urbano"
  },
  {
    measure: "Deprivation Social Security",
    key: "seguridad-social",
    label: "Carencia de acceso a la seguridad social",
    layer: "institucional"
  }
];

function pct(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getMunicipalProfile(settlementId?: string): Promise<MunicipalProfile> {
  const settlement = getSettlement(settlementId || "boca-del-rio");
  const inegiCode = settlement.inegi?.areaCode;
  if (!inegiCode) {
    throw new Error(`El asentamiento ${settlement.id} no tiene clave INEGI configurada`);
  }

  // Cubos oficiales en paralelo. Si alguno falla, esa parte degrada honestamente PERO se LOGUEA y
  // marca `partial` (antes el error se tragaba en silencio y el perfil salía con datos null y
  // confianza "oficial" sin distinguir "sin dato" de "API caída").
  let degraded = false;
  async function safeCube<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      degraded = true;
      console.warn(`[socioeconomic] cubo ${label} no disponible: ${error instanceof Error ? error.message : error}`);
      return fallback;
    }
  }

  const [populationRows, povertyRows, digitalAccess, securityProxy] = await Promise.all([
    safeCube(
      "inegi_population",
      fetchCube({
        cube: "inegi_population",
        drilldowns: ["Year", "Municipality"],
        measures: ["Population"],
        cuts: { Municipality: inegiCode }
      }),
      [] as CubeRecord[]
    ),
    safeCube(
      "coneval_poverty",
      fetchCube({
        cube: "coneval_poverty",
        drilldowns: ["Year", "Municipality"],
        measures: ["Population", "Poverty", ...CONEVAL_DEPRIVATIONS.map((d) => d.measure)],
        cuts: { Municipality: inegiCode }
      }),
      [] as CubeRecord[]
    ),
    safeCube("inegi_housing_basic", getDigitalAccessMetric(inegiCode), null),
    safeCube("inegi_envipe", getSecurityProxyMetric(inegiCode), null)
  ]);

  const latestPopulation = latestByYear(populationRows);
  const latestPoverty = latestByYear(povertyRows);

  // Descriptivo
  const populationMetric: ProfileMetric | null =
    latestPopulation && num(latestPopulation, "Population") !== null
      ? {
          key: "poblacion",
          label: "Población",
          value: num(latestPopulation, "Population")!,
          unit: "people",
          year: Number(latestPopulation["Year"]),
          layer: "social"
        }
      : null;

  const conevalPop = num(latestPoverty, "Population");
  const povertyRateMetric: ProfileMetric | null =
    latestPoverty && pct(num(latestPoverty, "Poverty"), conevalPop) !== null
      ? {
          key: "pobreza",
          label: "Población en situación de pobreza",
          value: pct(num(latestPoverty, "Poverty"), conevalPop)!,
          unit: "pct",
          year: Number(latestPoverty["Year"]),
          layer: "economico"
        }
      : null;

  // Diagnóstico: carencias como % de la población, ordenadas (la mayor explica la zona).
  const deprivations: DeprivationMetric[] = latestPoverty
    ? CONEVAL_DEPRIVATIONS.map((d) => ({ d, value: pct(num(latestPoverty, d.measure), conevalPop) }))
        .filter((entry): entry is { d: (typeof CONEVAL_DEPRIVATIONS)[number]; value: number } => entry.value !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({
          key: entry.d.key,
          label: entry.d.label,
          value: entry.value,
          unit: "pct" as const,
          year: Number(latestPoverty["Year"]),
          layer: entry.d.layer,
          rank: index + 1
        }))
    : [];

  // Predictivo: tendencia observada de pobreza 2010→último corte (no es una proyección).
  const povertySeries: TrendPoint[] = povertyRows
    .map((row) => ({ year: Number(row["Year"]), pct: pct(num(row, "Poverty"), num(row, "Population")) }))
    .filter((point): point is TrendPoint => Number.isFinite(point.year) && point.pct !== null)
    .sort((a, b) => a.year - b.year);

  const povertyTrend = buildTrend(povertySeries);

  // Prescriptivo: señal de prioridad = carencia dominante. Explicable y honesta, no un veredicto.
  const dominant = deprivations[0] || null;
  const priority = dominant
    ? {
        signal: `La carencia que más pesa hoy es "${dominant.label.toLowerCase()}" (${dominant.value}%). Es el primer frente a observar y cruzar con evidencia local.`,
        layer: dominant.layer
      }
    : null;

  const vintage = [populationMetric?.year, povertyRateMetric?.year]
    .filter((year): year is number => typeof year === "number")
    .sort((a, b) => b - a)[0];

  return {
    settlement: { id: settlement.id, name: settlement.name, inegiCode },
    source: { ...DATAMEXICO_SOURCE, vintage: vintage ? String(vintage) : "n/d" },
    confidence: "official",
    partial: degraded,
    dimensions: {
      descriptive: {
        population: populationMetric,
        povertyRate: povertyRateMetric,
        indicators: [digitalAccess, securityProxy].filter((m): m is ProfileMetric => m !== null)
      },
      diagnostic: { deprivations, dominant },
      predictive: {
        basis: "Tendencia observada en cortes CONEVAL (no es una proyección modelada).",
        povertyTrend
      },
      prescriptive: {
        basis:
          "Señal de prioridad derivada de la carencia dominante. El índice de decisión completo se construye en OIS.",
        priority
      }
    }
  };
}

// Acceso digital del hogar (INEGI housing): hogares con internet / total de viviendas.
// Llena la capa "tecnología y datos" del paradigma, hoy sin un solo dato medido.
async function getDigitalAccessMetric(inegiCode: string): Promise<ProfileMetric | null> {
  const rows = await fetchCube({
    cube: "inegi_housing_basic",
    drilldowns: ["Year", "Municipality"],
    measures: ["Private Homes Inhabitants", "Internet"],
    cuts: { Municipality: inegiCode }
  });
  const latest = latestByYear(rows);
  const homes = num(latest, "Private Homes Inhabitants");
  const value = pct(num(latest, "Internet"), homes);
  if (!latest || value === null) return null;
  return {
    key: "internet",
    label: "Hogares con acceso a internet",
    value,
    unit: "pct",
    year: Number(latest["Year"]),
    layer: "social"
  };
}

// Proxy oficial de inseguridad percibida (ENVIPE): % de hogares que gastaron en protección
// contra el delito. NO es tasa delictiva; es gasto defensivo del hogar — se etiqueta como tal.
// Sirve al eje "ciudad con miedo". Se excluye el tramo "Undefined" (id 99) para no inflar.
async function getSecurityProxyMetric(inegiCode: string): Promise<ProfileMetric | null> {
  const [totalRows, breakdownRows] = await Promise.all([
    fetchCube({
      cube: "inegi_envipe",
      drilldowns: ["Year", "Municipality"],
      measures: ["Homes"],
      cuts: { Municipality: inegiCode }
    }),
    fetchCube({
      cube: "inegi_envipe",
      drilldowns: ["Year", "Expenses in Protection Against Crime"],
      measures: ["Homes"],
      cuts: { Municipality: inegiCode }
    })
  ]);
  const latestTotal = latestByYear(totalRows);
  if (!latestTotal) return null;
  const year = Number(latestTotal["Year"]);
  const total = num(latestTotal, "Homes");
  const yearBreakdown = breakdownRows.filter(
    (row) => Number(row["Year"]) === year && String(row["Expenses in Protection Against Crime ID"]) !== "99"
  );
  // Sin filas de desglose para el año → null, NO 0%. Antes pct(0, total>0) devolvía 0 y se publicaba
  // "0% de hogares que gastan en protección" como dato oficial cuando en realidad faltaba el desglose.
  if (yearBreakdown.length === 0) return null;
  const spent = yearBreakdown.reduce((sum, row) => sum + (num(row, "Homes") ?? 0), 0);
  const value = pct(spent, total);
  if (value === null) return null;
  return {
    key: "inseguridad-gasto",
    label: "Hogares que gastan en protección contra el delito",
    value,
    unit: "pct",
    year,
    layer: "institucional"
  };
}

function latestByYear(rows: CubeRecord[]): CubeRecord | null {
  if (!rows.length) return null;
  return rows.reduce((latest, row) => (Number(row["Year"]) > Number(latest["Year"]) ? row : latest));
}

function buildTrend(series: TrendPoint[]): MunicipalProfile["dimensions"]["predictive"]["povertyTrend"] {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const deltaPctPoints = Math.round((last.pct - first.pct) * 10) / 10;
  const direction = deltaPctPoints > 1 ? "rising" : deltaPctPoints < -1 ? "falling" : "stable";
  return { series, direction, deltaPctPoints };
}
