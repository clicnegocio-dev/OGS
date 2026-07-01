import { NextResponse } from "next/server";
import { upstreamError } from "@/lib/http";

// NOTA: endpoint interno/experimental — hoy NINGÚN cliente lo consume (ver auditoría). Se conserva
// robustecido por si se cablea el panel CKAN; si no se reactiva, considerar retirarlo.
const CKAN_BASE = "https://datos.veracruzmunicipio.gob.mx/api/3/action";

type CkanPackage = {
  id: string;
  name: string;
  title: string;
  notes?: string;
  metadata_modified?: string;
  organization?: { title?: string; name?: string };
  tags?: { name: string }[];
  resources?: {
    id: string;
    name?: string;
    format?: string;
    url?: string;
    description?: string;
  }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  // `Number('abc')` es NaN y Math.min/Math.max no lo normalizan → antes se enviaba rows=NaN a CKAN.
  const parsedRows = Number(searchParams.get("rows") ?? 20);
  const rows = Number.isFinite(parsedRows) ? Math.min(50, Math.max(1, Math.round(parsedRows))) : 20;

  const url = new URL(`${CKAN_BASE}/package_search`);
  url.searchParams.set("rows", String(rows));
  if (query) url.searchParams.set("q", query);

  let json: { result?: { count?: number; results?: CkanPackage[] } };
  try {
    // El fetch + json() iban FUERA de try/catch → un timeout/DNS/body-no-JSON daba 500 opaco.
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 3600 } });
    if (!response.ok) {
      return upstreamError("La consulta a CKAN falló", { detail: `HTTP ${response.status}`, source: "CKAN Municipio de Veracruz", clientSafe: true });
    }
    json = await response.json();
  } catch (error) {
    return upstreamError("La consulta a CKAN falló", { detail: error, source: "CKAN Municipio de Veracruz" });
  }

  const packages = ((json.result?.results || []) as CkanPackage[]).map((item) => ({
    id: item.id,
    name: item.name,
    title: item.title,
    description: item.notes,
    organization: item.organization?.title || item.organization?.name,
    modifiedAt: item.metadata_modified,
    tags: item.tags?.map((tag) => tag.name) || [],
    resources:
      item.resources?.map((resource) => ({
        id: resource.id,
        name: resource.name,
        format: resource.format,
        url: resource.url,
        description: resource.description
      })) || []
  }));

  return NextResponse.json(
    {
      total: json.result?.count || packages.length,
      packages,
      source: "Datos Abiertos Municipio de Veracruz CKAN",
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
