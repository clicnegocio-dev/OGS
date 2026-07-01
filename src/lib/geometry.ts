export type Point = {
  lng: number;
  lat: number;
};

export function buildDataDrivenBoundary(points: Point[]): GeoJSON.Feature<GeoJSON.Polygon, { source: string; method: string; pointCount: number }> | null {
  const clean = points.filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));
  if (clean.length < 3) return null;

  const filtered = filterOutliers(clean);
  const hull = convexHull(filtered);
  if (hull.length < 3) return null;

  const padded = padPolygon(hull, 0.0012);
  const ring = padded.map((point) => [round(point.lng), round(point.lat)]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ring]
    },
    properties: {
      source: "INEGI DENUE points",
      method: "outlier-trimmed convex hull",
      pointCount: filtered.length
    }
  };
}

function filterOutliers(points: Point[]) {
  const lngs = points.map((point) => point.lng).sort((a, b) => a - b);
  const lats = points.map((point) => point.lat).sort((a, b) => a - b);
  const minLng = quantile(lngs, 0.01);
  const maxLng = quantile(lngs, 0.99);
  const minLat = quantile(lats, 0.01);
  const maxLat = quantile(lats, 0.99);
  return points.filter((point) => point.lng >= minLng && point.lng <= maxLng && point.lat >= minLat && point.lat <= maxLat);
}

function convexHull(points: Point[]) {
  const sorted = [...points]
    .sort((a, b) => a.lng - b.lng || a.lat - b.lat)
    .filter((point, index, arr) => index === 0 || point.lng !== arr[index - 1].lng || point.lat !== arr[index - 1].lat);

  if (sorted.length <= 1) return sorted;

  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function padPolygon(points: Point[], paddingDegrees: number) {
  const center = points.reduce(
    (acc, point) => ({ lng: acc.lng + point.lng / points.length, lat: acc.lat + point.lat / points.length }),
    { lng: 0, lat: 0 }
  );

  return points.map((point) => {
    const dx = point.lng - center.lng;
    const dy = point.lat - center.lat;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      lng: point.lng + (dx / length) * paddingDegrees,
      lat: point.lat + (dy / length) * paddingDegrees
    };
  });
}

function cross(origin: Point, a: Point, b: Point) {
  return (a.lng - origin.lng) * (b.lat - origin.lat) - (a.lat - origin.lat) * (b.lng - origin.lng);
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
