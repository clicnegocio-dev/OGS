import { NextResponse } from "next/server";
import { parseLat, parseLng } from "@/lib/geo";
import { upstreamError } from "@/lib/http";

const BOCA_DEL_RIO = { lat: 19.1589, lng: -96.1091 };

type RiskLevel = "low" | "medium" | "high";
type HydricRisk = { level: RiskLevel; label: string; reason: string };

// Condiciones ambientales reales en vivo (keyless): el filo de la realidad que un MVP SÍ puede
// mostrar sin infraestructura. Riesgo hídrico (riesgo #1 de Boca del Río), calor y calidad del aire.
// La susceptibilidad estructural a inundación (CENAPRED) y el histórico se materializan en OIS (ver SPEC).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseLat(searchParams.get("lat"), BOCA_DEL_RIO.lat);
  const lng = parseLng(searchParams.get("lng"), BOCA_DEL_RIO.lng);
  const city = searchParams.get("city") || "Boca del Río";

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=precipitation,rain,temperature_2m,apparent_temperature` +
    `&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=auto`;
  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=pm2_5,pm10,us_aqi,uv_index&timezone=auto`;

  try {
    const [forecastRes, airRes] = await Promise.allSettled([
      fetch(forecastUrl, { signal: AbortSignal.timeout(8000), next: { revalidate: 1800 } }),
      fetch(airUrl, { signal: AbortSignal.timeout(8000), next: { revalidate: 1800 } })
    ]);

    const forecast = await okJson(forecastRes);
    if (!forecast) throw new Error("Open-Meteo forecast no disponible");

    const currentPrecip = Number(forecast?.current?.precipitation ?? 0);
    const hourly: number[] = Array.isArray(forecast?.hourly?.precipitation) ? forecast.hourly.precipitation : [];
    const probs: number[] = Array.isArray(forecast?.hourly?.precipitation_probability)
      ? forecast.hourly.precipitation_probability
      : [];
    const next24Precip = hourly.slice(0, 24).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const maxProbability = probs.slice(0, 24).reduce((max, value) => Math.max(max, Number(value) || 0), 0);

    const temperatureC = Number(forecast?.current?.temperature_2m ?? NaN);
    const apparentC = Number(forecast?.current?.apparent_temperature ?? temperatureC);

    const air = await okJson(airRes);
    const usAqi = air ? Number(air?.current?.us_aqi ?? NaN) : NaN;
    const pm25 = air ? Number(air?.current?.pm2_5 ?? NaN) : NaN;

    return NextResponse.json(
      {
        city,
        coordinates: { lat, lng },
        current: { precipitationMm: round(currentPrecip) },
        next24h: { precipitationMm: round(next24Precip), maxProbabilityPct: maxProbability },
        risk: deriveHydricRisk(currentPrecip, next24Precip),
        heat: Number.isFinite(temperatureC)
          ? { temperatureC: round(temperatureC), apparentC: round(apparentC), level: deriveHeatLevel(apparentC) }
          : null,
        air: Number.isFinite(usAqi)
          ? { usAqi: Math.round(usAqi), pm25: round(pm25), ...deriveAirLevel(usAqi) }
          : null,
        confidence: "official",
        source: "Open-Meteo · en vivo (clima + calidad del aire)",
        sourceUrl: "https://open-meteo.com/",
        observedAt: forecast?.current?.time || new Date().toISOString(),
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600"
        }
      }
    );
  } catch (error) {
    // Mensaje genérico estable para el cliente; el detalle se loguea en servidor (no se filtra).
    return upstreamError("No se pudieron obtener las condiciones ambientales", {
      detail: error,
      source: "Open-Meteo"
    });
  }
}

async function okJson(result: PromiseSettledResult<Response>) {
  if (result.status !== "fulfilled" || !result.value.ok) return null;
  try {
    return await result.value.json();
  } catch {
    return null;
  }
}

function deriveHydricRisk(currentMm: number, next24Mm: number): HydricRisk {
  if (next24Mm >= 30 || currentMm >= 5) {
    return { level: "high", label: "Alta", reason: `Lluvia significativa pronosticada: ${round(next24Mm)} mm en 24 h.` };
  }
  if (next24Mm >= 8 || currentMm >= 1) {
    return { level: "medium", label: "Media", reason: `Lluvia moderada pronosticada: ${round(next24Mm)} mm en 24 h.` };
  }
  return { level: "low", label: "Baja", reason: `Sin lluvia relevante pronosticada: ${round(next24Mm)} mm en 24 h.` };
}

function deriveHeatLevel(apparentC: number): RiskLevel {
  if (apparentC >= 40) return "high";
  if (apparentC >= 33) return "medium";
  return "low";
}

// Umbrales US AQI (EPA): 0-50 buena, 51-100 moderada, >100 dañina para grupos sensibles+.
function deriveAirLevel(usAqi: number): { level: RiskLevel; label: string } {
  if (usAqi > 100) return { level: "high", label: "Mala" };
  if (usAqi > 50) return { level: "medium", label: "Moderada" };
  return { level: "low", label: "Buena" };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
