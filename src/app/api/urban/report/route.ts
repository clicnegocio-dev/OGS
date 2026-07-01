import { NextResponse } from "next/server";
import { isOisConfigured, submitCivicReport, OIS_SOURCE, type CivicReportInput } from "@/lib/ois";
import { upstreamError } from "@/lib/http";

export const runtime = "nodejs";

// Redondeo a ~100 m (3 decimales): ubica la señal sin señalar el hogar (anti-estigma/PII, doctrina).
function roundCoord(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(value * 1000) / 1000;
}

// Captura de señal ciudadana (Fase 1 del plan EU↔OIS): recibe el reporte del formulario in-app y lo
// envía a la PUERTA pública ya existente de OIS. NO toca OIS ni persiste nada en EU. Degrada honesto:
// sin OIS_BASE_URL devuelve configured=false para que la UI ofrezca el respaldo de WhatsApp.
// Ver docs/spec-integracion-eu-ois_v1.md §4 (A2).
export async function POST(request: Request) {
  if (!isOisConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        note: "Configura OIS_BASE_URL (y opcional OIS_TENANT_SLUG) para enviar señales a OIS. Mientras tanto, usa WhatsApp.",
        source: OIS_SOURCE,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let payload: Partial<CivicReportInput>;
  try {
    payload = (await request.json()) as Partial<CivicReportInput>;
  } catch {
    return upstreamError("Cuerpo de la solicitud inválido", { status: 400, clientSafe: true });
  }

  const reporterName = (payload.reporterName ?? "").trim();
  const email = (payload.email ?? "").trim();
  const phone = (payload.phone ?? "").trim();
  const description = (payload.description ?? "").trim();
  const lat = roundCoord(payload.lat);
  const lng = roundCoord(payload.lng);
  const hasGeo = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  // Validación de borde: la puerta de OIS exige nombre + AL MENOS un canal; EU exige una descripción.
  if (!reporterName) {
    return upstreamError("Falta tu nombre", { status: 422, clientSafe: true });
  }
  if (!email && !phone) {
    return upstreamError("Deja al menos un canal de contacto (correo o teléfono)", { status: 422, clientSafe: true });
  }
  if (!description) {
    return upstreamError("Describe la señal que observas", { status: 422, clientSafe: true });
  }

  try {
    const result = await submitCivicReport({
      reporterName,
      email: email || undefined,
      phone: phone || undefined,
      layer: payload.layer,
      eje: payload.eje,
      type: payload.type,
      severity: payload.severity,
      title: payload.title,
      description,
      settlement: payload.settlement,
      zone: payload.zone,
      lat: hasGeo ? lat : undefined,
      lng: hasGeo ? lng : undefined,
    });
    return NextResponse.json(
      { configured: true, ...result, source: OIS_SOURCE },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // submitCivicReport solo lanza mensajes seguros (sin host interno) → clientSafe.
    return upstreamError("No se pudo enviar la señal a OIS", {
      detail: error,
      source: OIS_SOURCE,
      clientSafe: true,
    });
  }
}
