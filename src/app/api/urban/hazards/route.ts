import { NextResponse } from "next/server";
import { distanceKm, parseLat, parseLng, parseRadiusKm } from "@/lib/geo";

type SourceResult = { ok: boolean; hazards: Hazard[] };

type Hazard = {
  id: string;
  layer: "riesgo";
  type: "sismo" | "clima" | "volcan" | "fuego";
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
  magnitude?: number;
  confidence: "official";
  privacy: "public";
  source: string;
  sourceUrl?: string;
  observedAt: string;
};

type UsgsFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number, number?];
  };
  properties?: {
    title?: string;
    place?: string;
    mag?: number;
    url?: string;
    time?: number;
  };
};

type EonetEvent = {
  id?: string;
  title?: string;
  categories?: { id?: string; title?: string }[];
  geometry?: {
    type?: string;
    coordinates?: [number, number];
    date?: string;
  }[];
  sources?: { url?: string }[];
};

const BOCA_DEL_RIO = { lat: 19.1589, lng: -96.1091 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseLat(searchParams.get("lat"), BOCA_DEL_RIO.lat);
  const lng = parseLng(searchParams.get("lng"), BOCA_DEL_RIO.lng);
  const radiusKm = parseRadiusKm(searchParams.get("radiusKm"), 400);
  const center = { lat, lng };

  const [earthquakes, eonet] = await Promise.allSettled([
    fetchEarthquakes(center, radiusKm),
    fetchEonet(center, radiusKm)
  ]);

  // Estado POR FUENTE: para un observatorio de riesgo, "0 riesgos" porque no hay eventos NO puede
  // confundirse con "0" porque la fuente está caída. Solo declaramos las fuentes que respondieron.
  const usgs = earthquakes.status === "fulfilled" ? earthquakes.value : { ok: false, hazards: [] };
  const nasa = eonet.status === "fulfilled" ? eonet.value : { ok: false, hazards: [] };
  const hazards = [...usgs.hazards, ...nasa.hazards];

  const sourcesStatus = {
    "USGS Earthquake API": usgs.ok ? "ok" : "error",
    "NASA EONET": nasa.ok ? "ok" : "error"
  } as const;
  const sources = Object.entries(sourcesStatus)
    .filter(([, status]) => status === "ok")
    .map(([name]) => name);
  const degraded = !usgs.ok || !nasa.ok;

  return NextResponse.json(
    {
      hazards,
      total: hazards.length,
      degraded,
      timestamp: new Date().toISOString(),
      sources,
      sourcesStatus
    },
    {
      headers: {
        // Si alguna fuente falló, no cacheamos el resultado parcial en el CDN.
        "Cache-Control": degraded ? "no-store" : "public, s-maxage=300, stale-while-revalidate=900"
      }
    }
  );
}

async function fetchEarthquakes(center: { lat: number; lng: number }, radiusKm: number): Promise<SourceResult> {
  let response: Response;
  try {
    response = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson", {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 }
    });
  } catch {
    return { ok: false, hazards: [] };
  }

  if (!response.ok) return { ok: false, hazards: [] };
  const data = await response.json();

  const hazards = ((data.features || []) as UsgsFeature[])
    .map((feature) => {
      const coords = feature.geometry?.coordinates || [];
      const props = feature.properties || {};
      const severity: Hazard["severity"] = (props.mag || 0) >= 5 ? "high" : (props.mag || 0) >= 4 ? "medium" : "low";
      const lat = Number(coords[1]);
      const lng = Number(coords[0]);
      return {
        // id estable: usa el de USGS o, si falta, sintetiza uno con coords+tiempo (evita "usgs-undefined").
        id: feature.id ? `usgs-${feature.id}` : `usgs-${lat.toFixed(3)},${lng.toFixed(3)}-${props.time ?? "na"}`,
        layer: "riesgo" as const,
        type: "sismo" as const,
        title: props.title || "Sismo registrado",
        description: props.place || "Evento sismico registrado por USGS.",
        lat,
        lng,
        severity,
        magnitude: props.mag,
        confidence: "official" as const,
        privacy: "public" as const,
        source: "USGS Earthquake API",
        sourceUrl: props.url,
        observedAt: props.time ? new Date(props.time).toISOString() : new Date().toISOString()
      };
    })
    .filter((hazard: Hazard) => Number.isFinite(hazard.lat) && Number.isFinite(hazard.lng))
    .filter((hazard: Hazard) => distanceKm(center, hazard) <= radiusKm)
    .slice(0, 80);

  return { ok: true, hazards };
}

async function fetchEonet(center: { lat: number; lng: number }, radiusKm: number): Promise<SourceResult> {
  let response: Response;
  try {
    response = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100", {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 900 }
    });
  } catch {
    return { ok: false, hazards: [] };
  }

  if (!response.ok) return { ok: false, hazards: [] };
  const data = await response.json();

  const hazards = ((data.events || []) as EonetEvent[])
    .map((event): Hazard | null => {
      const geometry = event.geometry?.[event.geometry.length - 1];
      if (!geometry?.coordinates || geometry.type !== "Point") return null;
      const category = event.categories?.[0]?.id || "event";
      const type: Hazard["type"] = category === "volcanoes" ? "volcan" : category === "wildfires" ? "fuego" : "clima";
      const lat = Number(geometry.coordinates[1]);
      const lng = Number(geometry.coordinates[0]);
      return {
        id: event.id ? `eonet-${event.id}` : `eonet-${lat.toFixed(3)},${lng.toFixed(3)}-${geometry.date ?? "na"}`,
        layer: "riesgo" as const,
        type,
        title: event.title || "Evento ambiental activo",
        description: event.categories?.[0]?.title || "Evento ambiental activo reportado por NASA EONET.",
        lat,
        lng,
        severity: type === "volcan" || type === "fuego" ? "high" : "medium",
        confidence: "official" as const,
        privacy: "public" as const,
        source: "NASA EONET",
        sourceUrl: event.sources?.[0]?.url,
        observedAt: geometry.date || new Date().toISOString()
      } satisfies Hazard;
    })
    .filter((hazard): hazard is Hazard => hazard !== null)
    .filter((hazard: Hazard) => distanceKm(center, hazard) <= radiusKm)
    .slice(0, 80);

  return { ok: true, hazards };
}
