import { NextResponse } from "next/server";
import { getSettlement } from "@/config/settlements";
import { getRealEstateMarket, isMercadoLibreConfigured } from "@/lib/mercadolibre";

export const runtime = "nodejs";

// Mercado inmobiliario por municipio vía API oficial de Mercado Libre (dato con PRECIO,
// filtrado por estado/ciudad). Degrada honestamente: sin credenciales devuelve configured=false
// (no falla), para que la UI muestre "pendiente de credenciales" en vez de romperse.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settlement = getSettlement(searchParams.get("settlement") || "boca-del-rio");

  if (!isMercadoLibreConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        settlement: { id: settlement.id, name: settlement.name },
        note: "Configura ML_ACCESS_TOKEN o ML_CLIENT_ID/SECRET/REFRESH_TOKEN (ver .env.example y docs/arquitectura-analitica-4d.md).",
        source: "Mercado Libre · API oficial"
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const market = await getRealEstateMarket({ stateName: settlement.stateName, cityName: settlement.name });
    // `configured: true` explícito en las TRES ramas (no-config / error / éxito) para que la UI
    // pueda ramificar por ese flag de forma estable. `market` ya lo trae, pero lo fijamos por claridad.
    return NextResponse.json(
      { ...market, configured: true, settlementId: settlement.id },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    // No se filtra el detalle crudo al cliente (coherente con upstreamError del resto de /api/urban/*).
    console.error(`[market] ${settlement.id}: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      {
        configured: true,
        error: "No se pudo consultar el mercado inmobiliario",
        source: "Mercado Libre · API oficial",
        timestamp: new Date().toISOString()
      },
      { status: 502 }
    );
  }
}
