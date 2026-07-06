// Cliente de la PUERTA pública de OIS (la plataforma que aporta memoria/continuidad/operación).
// EU es una piel cívica MVP: NO construye backend propio; envía la señal del ciudadano a la
// superficie pública YA EXISTENTE de OIS — POST /public/site/{slug}/contact — sin tocar OIS.
// OIS es AGNÓSTICO: no tiene campos cívicos. Por eso la ontología de EU (capa, eje, tipo, severidad,
// ubicación, asentamiento) viaja serializada DENTRO de `message` (el sobre), no como columnas.
// Contrato verificado en ois-institucional/ois apps/backend-api/routers/public_contact.py.
// Ver docs/spec-integracion-eu-ois_v1.md §3-§4 (A2).

// Sin barra final: las rutas se componen como `${OIS_BASE_URL}/public/...`.
const OIS_BASE_URL = (process.env.OIS_BASE_URL ?? "").replace(/\/+$/, "");
// Slug del TENANT de EU en OIS (distinto del asentamiento). Sembrado en OIS como "ecosistemaurbano".
const OIS_TENANT_SLUG = process.env.OIS_TENANT_SLUG || "ecosistemaurbano";

export const OIS_SOURCE = "OIS · puerta pública de captura";

export function isOisConfigured(): boolean {
  return OIS_BASE_URL.length > 0;
}

export type CivicReportInput = {
  // Declarado por el ciudadano (lo que la puerta de OIS exige): nombre + AL MENOS un canal.
  reporterName: string;
  email?: string;
  phone?: string;
  // La señal cívica (ontología de EU; viaja en el sobre `message`, no como campos de OIS):
  layer?: string;
  eje?: string;
  type?: string;
  severity?: string;
  title?: string;
  description: string;
  settlement?: string;
  zone?: string;
  // Geo es de EU (OIS es agnóstico): coordenadas APROXIMADAS de la señal, ya redondeadas en el borde.
  lat?: number;
  lng?: number;
};

export type CivicReportResult = {
  received: boolean;
  message: string;
  reply: string | null;
  handoff: boolean;
};

// Serializa la señal cívica a un texto legible (≤2000, límite de OIS). El Operator ("SARA") lo lee
// y responde/escala. La estructura va legible para humano; OIS no la interpreta como dato cívico.
export function buildReportMessage(input: CivicReportInput): string {
  const lines: string[] = ["[Ecosistema Urbano · Reporte ciudadano]"];
  const meta: string[] = [];
  if (input.layer) meta.push(`Capa: ${input.layer}`);
  if (input.eje) meta.push(`Eje: ${input.eje}`);
  if (input.type) meta.push(`Tipo: ${input.type}`);
  if (input.severity) meta.push(`Severidad: ${input.severity}`);
  if (meta.length) lines.push(meta.join(" · "));
  const loc: string[] = [];
  if (input.settlement) loc.push(`Asentamiento: ${input.settlement}`);
  if (input.zone) loc.push(`Zona: ${input.zone}`);
  if (input.lat != null && input.lng != null) loc.push(`Ubicación aprox.: ${input.lat}, ${input.lng}`);
  if (loc.length) lines.push(loc.join(" · "));
  if (input.title) lines.push(`Título: ${input.title}`);
  lines.push("", input.description.trim(), "");
  lines.push("— Señal individual (piel cívica EU); sin verificación ni agregación aún.");
  return lines.join("\n").slice(0, 2000);
}

type OisContactResult = {
  received?: boolean;
  message?: string;
  reply?: string | null;
  handoff?: boolean;
};

// POST a la puerta pública de OIS. Lanza Error con mensaje SEGURO para el cliente (sin filtrar host
// interno) en red/timeout, 404, 429 o validación 4xx.
export async function submitCivicReport(input: CivicReportInput): Promise<CivicReportResult> {
  if (!isOisConfigured()) {
    throw new Error("OIS no está configurado (falta OIS_BASE_URL).");
  }
  const url = `${OIS_BASE_URL}/public/site/${encodeURIComponent(OIS_TENANT_SLUG)}/contact`;
  const body = {
    display_name: input.reporterName.trim().slice(0, 200),
    email: input.email?.trim() ? input.email.trim().slice(0, 320) : null,
    phone: input.phone?.trim() ? input.phone.trim().slice(0, 40) : null,
    message: buildReportMessage(input)
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    // Red/DNS/timeout: NO propagar el mensaje crudo (puede contener el host interno de OIS).
    throw new Error("No se pudo contactar a OIS (red o tiempo de espera).");
  }

  if (response.status === 404) {
    // El slug del tenant no resuelve en OIS (¿dominio sin sembrar/verificar?).
    throw new Error("El tenant de Ecosistema Urbano aún no está disponible en OIS.");
  }
  if (response.status === 429) {
    throw new Error("Demasiados envíos; intenta de nuevo en un rato.");
  }
  if (!response.ok) {
    // 422 de validación (p.ej. falta canal) u otro estado upstream.
    throw new Error(`La puerta de OIS rechazó el envío (HTTP ${response.status}).`);
  }

  const data = (await response.json().catch(() => ({}))) as OisContactResult;
  return {
    received: Boolean(data.received),
    message: data.message ?? "Recibido.",
    reply: data.reply ?? null,
    handoff: Boolean(data.handoff)
  };
}
