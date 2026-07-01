import { NextResponse } from "next/server";
import { urbanSignals } from "@/data/urban-signals";
import { distanceKm, parseLat, parseLng, parseRadiusKm } from "@/lib/geo";

const BOCA_DEL_RIO = { lat: 19.1589, lng: -96.1091 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseLat(searchParams.get("lat"), BOCA_DEL_RIO.lat);
  const lng = parseLng(searchParams.get("lng"), BOCA_DEL_RIO.lng);
  const radiusKm = parseRadiusKm(searchParams.get("radiusKm"), 25);
  const settlementId = searchParams.get("settlement");
  const center = { lat, lng };

  const signals = urbanSignals.filter((signal) => {
    if (settlementId && signal.settlementId !== settlementId) return false;
    return distanceKm(center, signal) <= radiusKm;
  });

  return NextResponse.json(
    {
      city: searchParams.get("city") || "Boca del Río",
      signals,
      total: signals.length,
      timestamp: new Date().toISOString(),
      source: "Ecosistema Urbano seed dataset"
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
      }
    }
  );
}
