import { NextResponse } from "next/server";
import { getSettlement, SETTLEMENTS } from "@/config/settlements";
import { cached } from "@/lib/cache";
import { getDenueDataset } from "@/lib/denue-service";
import { buildDataDrivenBoundary } from "@/lib/geometry";

// El método "denue" deriva la huella desde puntos oficiales (puede paginar): Node + headroom.
export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_METHODS = new Set(["denue", "seed"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSettlement = searchParams.get("settlement") || "boca-del-rio";
  // Validación de entrada: resolvemos a un id conocido y acotamos el método a la lista permitida,
  // ANTES de construir la clave de cache (evita que ids basura inflen el Map FIFO compartido).
  const settlementId = SETTLEMENTS[requestedSettlement] ? requestedSettlement : "boca-del-rio";
  const method = ALLOWED_METHODS.has(searchParams.get("method") || "") ? searchParams.get("method")! : "denue";

  const payload = await cached(
    `boundary:${settlementId}:${method}`,
    24 * 60 * 60 * 1000,
    async () => {
      const settlement = getSettlement(settlementId);

      // Intento de huella derivada de DENUE. Si falta token o DENUE falla/timeoutea, NO tumbamos el
      // endpoint (antes lanzaba 500): caemos a la frontera semilla con un warning honesto y marcamos
      // `degraded` para no cachear 24h una semilla causada por un blip upstream.
      let denueResult: Awaited<ReturnType<typeof buildBoundaryFromDenue>> = null;
      let degraded = false;
      if (method === "denue") {
        try {
          denueResult = await buildBoundaryFromDenue(settlement.id);
        } catch (error) {
          console.error(
            `[boundary] DENUE no disponible para ${settlement.id}:`,
            error instanceof Error ? error.message : error
          );
          degraded = true;
        }
        // #C4 (auditoría): DENUE NO lanza en fallo de red/HTTP — devuelve 0 puntos y buildBoundary…
        // → null, cayendo a la semilla. Sin esto, esa semilla por blip upstream se fijaba 24h + CDN
        // una semana (justo lo que shouldCache pretendía evitar). Un null aquí = degradado.
        if (!denueResult) degraded = true;
      }

      const boundary = denueResult?.boundary || settlement.boundary;

      return {
        degraded,
        settlement: {
          id: settlement.id,
          name: settlement.name,
          stateName: settlement.stateName,
          country: settlement.country,
          center: settlement.center,
          inegi: settlement.inegi
        },
        boundary,
        source: boundary.properties.source,
        method: boundary.properties.method || method,
        precision: boundary.properties.precision,
        completeness: denueResult?.completeness || {
          complete: false,
          warning: degraded
            ? "No se pudo derivar la huella desde DENUE (token ausente o error upstream). Mostrando frontera semilla."
            : "Usando frontera semilla. No había dataset oficial-derivado disponible."
        },
        timestamp: new Date().toISOString()
      };
    },
    // No fijes 24h una semilla degradada por un fallo transitorio: que se reintente al siguiente request.
    { shouldCache: (p) => !p.degraded }
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": payload.degraded ? "no-store" : "public, s-maxage=86400, stale-while-revalidate=604800"
    }
  });
}

async function buildBoundaryFromDenue(settlementId: string) {
  const dataset = await getDenueDataset({ settlementId, mode: "area", condition: "todos" });
  const boundary = buildDataDrivenBoundary(dataset.businesses);
  if (!boundary) return null;

  return {
    boundary: {
      ...boundary,
      properties: {
        ...boundary.properties,
        id: dataset.settlement.id,
        name: dataset.settlement.name,
        source: "Huella derivada de puntos oficiales INEGI DENUE (no es el límite jurídico)",
        precision: "denue-derived" as const,
        complete: dataset.completeness.complete
      }
    },
    completeness: dataset.completeness
  };
}
