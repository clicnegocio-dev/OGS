// Conector a la API OFICIAL de Mercado Libre (vía compatible elegida para dato inmobiliario:
// scrapear portales no es viable sin evadir WAF / violar ToS; la API oficial sí lo permite).
//
// Requiere credenciales OAuth (app gratuita en https://developers.mercadolibre.com.mx).
// Variables de entorno (ver .env.example):
//   - ML_ACCESS_TOKEN  (opcional, simple): token de 6 h para pruebas locales.
//   - ML_CLIENT_ID / ML_CLIENT_SECRET / ML_REFRESH_TOKEN (producción): se mintea el access token.
//
// CAVEAT operativo: el refresh_token de ML ROTA en cada uso. Un server sin persistencia no puede
// guardar el nuevo refresh_token → en OIS esto vive en un worker con base de datos. En el MVP se
// usa ML_ACCESS_TOKEN directo, o se acepta que el refresh rota (se documenta en el doc).

import { cached } from "@/lib/cache";

const ML_API = "https://api.mercadolibre.com";
const SITE = "MLM"; // México
const REAL_ESTATE_CATEGORY = "MLM1459"; // Inmuebles
const TOKEN_TTL_MS = 5 * 60 * 60 * 1000; // access token dura 6 h; refrescamos a las 5 h.

export class MlNotConfiguredError extends Error {
  constructor() {
    super("Mercado Libre no está configurado (faltan ML_ACCESS_TOKEN o ML_CLIENT_ID/SECRET/REFRESH_TOKEN).");
    this.name = "MlNotConfiguredError";
  }
}

export function isMercadoLibreConfigured(): boolean {
  return Boolean(process.env.ML_ACCESS_TOKEN || (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET && process.env.ML_REFRESH_TOKEN));
}

async function getAccessToken(): Promise<string> {
  if (process.env.ML_ACCESS_TOKEN) return process.env.ML_ACCESS_TOKEN;
  if (!isMercadoLibreConfigured()) throw new MlNotConfiguredError();

  return cached<string>("ml-access-token", TOKEN_TTL_MS, async () => {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: process.env.ML_REFRESH_TOKEN!
    });
    const response = await fetch(`${ML_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`ML token HTTP ${response.status}`);
    const json = (await response.json()) as { access_token?: string; refresh_token?: string };
    if (!json.access_token) throw new Error("ML token sin access_token");
    // El refresh_token de ML ROTA en cada uso. No podemos persistirlo en el MVP (no hay store
    // durable), pero lo avisamos: el ML_REFRESH_TOKEN del .env quedó invalidado y hay que reemplazarlo
    // por este nuevo valor, o el siguiente refresh fallará. Persistirlo es trabajo de OIS (worker+DB).
    if (json.refresh_token && json.refresh_token !== process.env.ML_REFRESH_TOKEN) {
      console.warn(
        "[mercadolibre] El refresh_token de ML rotó. Actualiza ML_REFRESH_TOKEN en .env.local con el nuevo valor o el próximo refresh fallará (persistencia durable = OIS)."
      );
    }
    return json.access_token;
  });
}

async function mlGet(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(`${ML_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 3600 }
  });
  if (!response.ok) throw new Error(`ML ${path} HTTP ${response.status}`);
  return response.json();
}

// Resuelve los ids de classified_location de ML para un estado + ciudad (≈ municipio) por nombre.
async function resolveLocationIds(stateName: string, cityName: string): Promise<{ stateId?: string; cityId?: string }> {
  const country = (await mlGet(`/classified_locations/countries/MX`)) as { states?: { id: string; name: string }[] };
  const state = (country.states || []).find((s) => normalize(s.name).includes(normalize(stateName)) || normalize(stateName).includes(normalize(s.name)));
  if (!state) return {};
  const stateData = (await mlGet(`/classified_locations/states/${state.id}`)) as { cities?: { id: string; name: string }[] };
  const city = (stateData.cities || []).find((c) => normalize(c.name).includes(normalize(cityName)) || normalize(cityName).includes(normalize(c.name)));
  return { stateId: state.id, cityId: city?.id };
}

export type MlListing = {
  id: string;
  title: string;
  priceMXN: number | null;
  operation: string | null; // Venta | Renta (de attributes)
  propertyType: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  url: string;
};

export type MarketSummary = {
  configured: true;
  settlement: { stateName: string; cityName: string };
  resolved: { stateId?: string; cityId?: string };
  inventory: number; // total de publicaciones (paging.total)
  sampled: number;
  medianPriceMXN: number | null;
  byOperation: Record<string, { count: number; medianPriceMXN: number | null }>;
  byZip: Record<string, number>;
  listings: MlListing[];
  source: string;
  sourceUrl: string;
  vintage: string;
};

type MlSearchResponse = {
  paging?: { total?: number };
  results?: Array<{
    id?: string;
    title?: string;
    price?: number;
    currency_id?: string;
    permalink?: string;
    location?: { zip_code?: string; latitude?: number; longitude?: number };
    attributes?: Array<{ id?: string; value_name?: string }>;
  }>;
};

// Mercado inmobiliario por municipio (≈ city de ML). Devuelve inventario + estadísticos de precio.
export async function getRealEstateMarket({
  stateName,
  cityName,
  limit = 50
}: {
  stateName: string;
  cityName: string;
  limit?: number;
}): Promise<MarketSummary> {
  if (!isMercadoLibreConfigured()) throw new MlNotConfiguredError();

  const { stateId, cityId } = await resolveLocationIds(stateName, cityName);
  const params = new URLSearchParams({ category: REAL_ESTATE_CATEGORY, limit: String(limit) });
  if (stateId) params.set("state", stateId);
  if (cityId) params.set("city", cityId);

  const data = (await mlGet(`/sites/${SITE}/search?${params.toString()}`)) as MlSearchResponse;
  const listings: MlListing[] = (data.results || []).map((item) => ({
    id: String(item.id ?? ""),
    title: item.title ?? "Publicación",
    priceMXN: item.currency_id === "MXN" && typeof item.price === "number" ? item.price : null,
    operation: attr(item.attributes, "OPERATION"),
    propertyType: attr(item.attributes, "PROPERTY_TYPE"),
    zipCode: item.location?.zip_code ?? null,
    lat: item.location?.latitude ?? null,
    lng: item.location?.longitude ?? null,
    url: item.permalink ?? ""
  }));

  const byOperation: MarketSummary["byOperation"] = {};
  for (const operation of new Set(listings.map((l) => l.operation || "Otra"))) {
    const subset = listings.filter((l) => (l.operation || "Otra") === operation);
    byOperation[operation] = { count: subset.length, medianPriceMXN: median(subset.map((l) => l.priceMXN)) };
  }

  const byZip: Record<string, number> = {};
  for (const listing of listings) {
    if (listing.zipCode) byZip[listing.zipCode] = (byZip[listing.zipCode] || 0) + 1;
  }

  return {
    configured: true,
    settlement: { stateName, cityName },
    resolved: { stateId, cityId },
    inventory: data.paging?.total ?? listings.length,
    sampled: listings.length,
    medianPriceMXN: median(listings.map((l) => l.priceMXN)),
    byOperation,
    byZip,
    listings,
    source: "Mercado Libre · API oficial",
    sourceUrl: "https://www.mercadolibre.com.mx/c/inmuebles",
    vintage: new Date().toISOString().slice(0, 10)
  };
}

function attr(attributes: Array<{ id?: string; value_name?: string }> | undefined, id: string): string | null {
  return attributes?.find((a) => a.id === id)?.value_name ?? null;
}

function median(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
