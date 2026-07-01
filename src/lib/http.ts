import { NextResponse } from "next/server";

// Contrato de error UNIFORME para todas las rutas /api/urban/*.
// Antes cada endpoint devolvía formas/estados distintos ante fallo upstream (502 vs 500 vs 200
// con arrays vacíos); esto estandariza el sobre { error, detail, source?, timestamp } y el status.
// El `detail` interno se LOGUEA en servidor, no se filtra crudo al cliente salvo que sea seguro.

export type UpstreamErrorOptions = {
  detail?: unknown;
  status?: number;
  source?: string;
  // Mensaje genérico estable para el cliente; el detalle real va al log del servidor.
  clientSafe?: boolean;
};

export function upstreamError(message: string, options: UpstreamErrorOptions = {}) {
  const { detail, status = 502, source, clientSafe = false } = options;
  const detailText = detail instanceof Error ? detail.message : detail != null ? String(detail) : undefined;

  // Observabilidad: el detalle siempre se registra en servidor (no se traga en silencio).
  if (detailText) console.error(`[upstream] ${message}: ${detailText}`);

  return NextResponse.json(
    {
      error: message,
      // Solo exponemos el detalle al cliente cuando es seguro (no contiene secretos/URLs internas).
      detail: clientSafe ? detailText : undefined,
      source,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

// Cache-Control para respuestas degradadas/parciales: NO se cachean en CDN (evita "envenenar"
// el edge con un "0 resultados" producto de un blip upstream).
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
