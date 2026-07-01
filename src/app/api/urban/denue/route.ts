import { NextResponse } from "next/server";
import { getDenueDataset, denueToFullSignals, denueToMapSignals, summarizeDenue } from "@/lib/denue-service";
import { clamp, parseLat, parseLng, toNumber } from "@/lib/geo";
import { upstreamError } from "@/lib/http";

// El barrido DENUE puede encadenar varias páginas: corre en Node y con presupuesto de tiempo amplio
// (el servicio se autolimita a ~18s; aquí damos headroom para no matar la función antes de degradar).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settlementId = searchParams.get("settlement") || "boca-del-rio";
  const condition = searchParams.get("condition") || "todos";
  const mode = searchParams.get("mode") === "radius" ? "radius" : "area";
  const detail = searchParams.get("detail") === "full" ? "full" : "map";

  try {
    const dataset = await getDenueDataset({
      settlementId,
      condition,
      mode,
      lat: parseLat(searchParams.get("lat"), 19.1589),
      lng: parseLng(searchParams.get("lng"), -96.1091),
      distanceMeters: clamp(Math.round(toNumber(searchParams.get("distanceMeters"), 2500)), 100, 5000)
    });

    const signals = detail === "full" ? denueToFullSignals(dataset) : denueToMapSignals(dataset);

    return NextResponse.json(
      {
        settlement: {
          id: dataset.settlement.id,
          name: dataset.settlement.name,
          stateName: dataset.settlement.stateName,
          country: dataset.settlement.country,
          center: dataset.settlement.center,
          inegi: dataset.settlement.inegi
        },
        signals,
        businesses: detail === "full" ? dataset.businesses : undefined,
        total: dataset.businesses.length,
        summary: summarizeDenue(dataset),
        completeness: dataset.completeness,
        source: dataset.source,
        timestamp: dataset.timestamp
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
        }
      }
    );
  } catch (error) {
    // Token ausente o fallo inesperado: sobre de error uniforme (502) + log en servidor.
    return upstreamError("No se pudo consultar DENUE", { detail: error, source: "INEGI DENUE", clientSafe: true });
  }
}
