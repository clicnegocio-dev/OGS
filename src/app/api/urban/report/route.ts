import { NextResponse } from "next/server";
import { isOisConfigured, submitCivicReport, OIS_SOURCE, type CivicReportInput } from "@/lib/ois";
import { upstreamError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// #A1 (auditoría): este es el único endpoint de ESCRITURA y reenvía a la puerta pública de OIS.
// Límites de abuso: tope de cuerpo (evita materializar MB en memoria antes de recortar) y rate-limit
// best-effort por IP. La severidad se valida contra la unión conocida (basura no viaja a OIS).
const MAX_BODY_BYTES = 10_000;
const RATE_LIMIT = 5; // envíos…
const RATE_WINDOW_MS = 10 * 60 * 1000; // …por 10 min por IP (best-effort; ver lib/rate-limit)
const VALID_SEVERITY = new Set(["low", "medium", "high"]);

// IP del cliente para el rate-limit (best-effort; detrás de CDN estos headers son de confianza).
function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

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
        source: OIS_SOURCE
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Rate-limit ANTES de leer/parsear el cuerpo (frena el spam sin gastar trabajo).
  const rate = checkRateLimit(`report:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados envíos; intenta de nuevo en un rato." },
      {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) }
      }
    );
  }

  // Tope de tamaño: rechaza cuerpos gigantes por Content-Length antes de materializarlos en memoria.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return upstreamError("El reporte es demasiado grande", { status: 413, clientSafe: true });
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
  // Severidad: solo la unión conocida viaja a OIS; cualquier otra cosa se descarta (no se rechaza el
  // reporte por ello, pero no dejamos que texto arbitrario llegue al Operator).
  const severity = VALID_SEVERITY.has(payload.severity ?? "") ? payload.severity : undefined;

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
      severity,
      title: payload.title,
      description,
      settlement: payload.settlement,
      zone: payload.zone,
      lat: hasGeo ? lat : undefined,
      lng: hasGeo ? lng : undefined
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
      clientSafe: true
    });
  }
}
