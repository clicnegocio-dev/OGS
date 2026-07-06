import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";

const CIVIC_DEFAULT = {
  status: "fallback" as const,
  lat: 19.1589,
  lng: -96.1091,
  city: "Boca del Río",
  region: "Veracruz",
  country: "México",
  source: "default"
};

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

// Detección correcta de IP privada/reservada (antes `startsWith('172.')` marcaba TODO 172.x como
// privado, cuando RFC1918 es solo 172.16-31; tampoco cubría link-local ni IPv6 ULA).
function isPrivateOrReserved(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1") return true; // loopback IPv6
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("fe80")) return true; // fe80::/10 link-local
  if (IPV4.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127 || a === 10) return true; // loopback / 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0 || a >= 224) return true; // 0.0.0.0/8 y multicast/reservado
    return false;
  }
  // No es IPv4 plana ni IPv6 reconocible → trátala como no usable.
  return !IPV6.test(ip);
}

export async function GET(request: NextRequest) {
  const rawIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";

  const ip = isPrivateOrReserved(rawIp) ? "" : rawIp;

  const payload = await cached(
    `geo:${ip || "anon"}`,
    60 * 60 * 1000,
    async () => {
      try {
        // La IP ya pasó validación de formato (IPV4/IPV6) y se codifica antes de interpolar.
        const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "EcosistemaUrbano/0.1 (+observatorio civico; comercializacion.gj@gmail.com)" }
        });

        if (response.ok) {
          const data = await response.json();
          // Number.isFinite acepta lat/lng = 0 (ecuador/Greenwich); el `&&` anterior los descartaba.
          if (!data.error && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
            return {
              status: "success" as const,
              lat: Number(data.latitude),
              lng: Number(data.longitude),
              city: data.city,
              region: data.region,
              country: data.country_name,
              source: "ipapi.co"
            };
          }
        }
      } catch {
        // Cae al default cívico.
      }
      return CIVIC_DEFAULT;
    },
    { shouldCache: (p) => p.status === "success" }
  );

  return NextResponse.json(payload, {
    // Geolocalización por IP = respuesta por-cliente: el navegador la cachea, el CDN no la comparte.
    headers: { "Cache-Control": "private, max-age=600" }
  });
}
