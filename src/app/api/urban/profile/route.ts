import { NextResponse } from "next/server";
import { getMunicipalProfile } from "@/lib/socioeconomic";
import { DATAMEXICO_SOURCE } from "@/lib/datamexico";
import { upstreamError } from "@/lib/http";

export const runtime = "nodejs";

// Perfil socioeconómico oficial del municipio, estructurado por las 4 dimensiones de análisis
// (descriptivo / diagnóstico / predictivo / prescriptivo). Fuente: DataMéxico (INEGI + CONEVAL).
// Sustituye el dossier de Wikipedia por evidencia oficial agregada con vintage honesto.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settlement = searchParams.get("settlement") || "boca-del-rio";

  try {
    const profile = await getMunicipalProfile(settlement);
    return NextResponse.json(profile, {
      headers: {
        // Los cortes oficiales se mueven en años; cache larga con revalidación.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch (error) {
    return upstreamError("No se pudo construir el perfil socioeconómico", {
      detail: error,
      source: DATAMEXICO_SOURCE.name,
      clientSafe: true
    });
  }
}
