// Cliente tipado para la API Tesseract de DataMéxico (Secretaría de Economía).
// DataMéxico expone datos OFICIALES ya agregados por municipio (INEGI, CONEVAL, CONAPO),
// vía cubos OLAP keyless. Es el atajo del MVP a la "data de decisión" sin montar PostGIS:
// lo que el SPEC reservaba para OIS (Censo, carencias, socioeconómico) ya viene servido
// a nivel municipio y con serie temporal 2010→2020.
//
// Host verificado en vivo (2026-06-29): el antiguo api.datamexico.org fue decomisionado;
// el backend actual es economia.gob.mx/apidatamexico/tesseract.
// Doc: https://www.economia.gob.mx/datamexico/en/about/infoapi

import { cached } from "@/lib/cache";

const TESSERACT_BASE = "https://www.economia.gob.mx/apidatamexico/tesseract";
const TTL_MS = 24 * 60 * 60 * 1000; // los cortes oficiales se mueven en años, no en horas.

export type CubeQuery = {
  cube: string;
  drilldowns: string[];
  measures: string[];
  // Un "cut" en Tesseract es <NombreDeNivel>=<idMiembro>. P.ej. { Municipality: "30028" }.
  cuts?: Record<string, string | number>;
};

// Registros JSON de Tesseract: claves como "Year", "Municipality ID", "Municipality"
// y una clave por cada measure solicitada. Valores numéricos vienen como number.
export type CubeRecord = Record<string, string | number>;

function buildUrl(query: CubeQuery): string {
  const url = new URL(`${TESSERACT_BASE}/data.jsonrecords`);
  url.searchParams.set("cube", query.cube);
  url.searchParams.set("drilldowns", query.drilldowns.join(","));
  url.searchParams.set("measures", query.measures.join(","));
  url.searchParams.set("parents", "false");
  url.searchParams.set("sparse", "false");
  if (query.cuts) {
    for (const [level, member] of Object.entries(query.cuts)) {
      url.searchParams.set(level, String(member));
    }
  }
  return url.toString();
}

// Consulta un cubo y devuelve sus registros. Cachea en memoria para no repegarle a la
// Secretaría en cada request (los datos son anuales/quinquenales).
export async function fetchCube(query: CubeQuery): Promise<CubeRecord[]> {
  const url = buildUrl(query);
  return cached<CubeRecord[]>(`datamexico:${url}`, TTL_MS, async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 }
    });
    if (!response.ok) {
      throw new Error(`DataMéxico ${query.cube} respondió HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data?: unknown };
    return Array.isArray(json.data) ? (json.data as CubeRecord[]) : [];
  });
}

export function num(record: CubeRecord | null | undefined, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const DATAMEXICO_SOURCE = {
  name: "DataMéxico · Secretaría de Economía",
  url: "https://www.economia.gob.mx/datamexico/"
} as const;
