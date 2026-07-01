export type Coordinate = {
  lat: number;
  lng: number;
};

export function distanceKm(a: Coordinate, b: Coordinate) {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function toNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Parsers de parámetros geográficos con VALIDACIÓN DE RANGO (no solo "es finito").
// Antes `toNumber` aceptaba lat=9999 o lng fuera de [-180,180] o radios negativos, que generaban
// resultados vacíos/erróneos en silencio y consultas absurdas contra terceros.
export function parseLat(value: string | null, fallback: number) {
  return clamp(toNumber(value, fallback), -90, 90);
}

export function parseLng(value: string | null, fallback: number) {
  return clamp(toNumber(value, fallback), -180, 180);
}

export function parseRadiusKm(value: string | null, fallback: number, max = 500) {
  const parsed = toNumber(value, fallback);
  return clamp(parsed > 0 ? parsed : fallback, 0.1, max);
}
