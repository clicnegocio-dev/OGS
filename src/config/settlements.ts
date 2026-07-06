export type Settlement = {
  id: string;
  name: string;
  stateName: string;
  country: string;
  center: { lat: number; lng: number };
  inegi?: {
    entityCode: string;
    municipalityCode: string;
    areaCode: string;
  };
  boundary: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    {
      id: string;
      name: string;
      source: string;
      precision: "seed" | "official" | "official-derived" | "denue-derived" | "postgis";
      method?: string;
      complete?: boolean;
    }
  >;
};

export const SETTLEMENTS: Record<string, Settlement> = {
  veracruz: {
    id: "veracruz",
    name: "Veracruz",
    stateName: "Veracruz",
    country: "México",
    center: { lat: 19.1738, lng: -96.1342 },
    inegi: {
      entityCode: "30",
      municipalityCode: "193",
      areaCode: "30193"
    },
    boundary: {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-96.235, 19.246],
            [-96.186, 19.262],
            [-96.117, 19.242],
            [-96.087, 19.197],
            [-96.091, 19.142],
            [-96.139, 19.099],
            [-96.205, 19.117],
            [-96.249, 19.168],
            [-96.235, 19.246]
          ]
        ]
      },
      properties: {
        id: "veracruz",
        name: "Veracruz",
        source: "MVP seed boundary; replace with INEGI Marco Geoestadistico/PostGIS",
        precision: "seed"
      }
    }
  },
  "boca-del-rio": {
    id: "boca-del-rio",
    name: "Boca del Río",
    stateName: "Veracruz",
    country: "México",
    center: { lat: 19.1589, lng: -96.1091 },
    inegi: {
      entityCode: "30",
      municipalityCode: "028",
      areaCode: "30028"
    },
    boundary: {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-96.171, 19.173],
            [-96.151, 19.188],
            [-96.126, 19.19],
            [-96.093, 19.176],
            [-96.078, 19.145],
            [-96.076, 19.111],
            [-96.088, 19.074],
            [-96.116, 19.067],
            [-96.146, 19.086],
            [-96.166, 19.118],
            [-96.174, 19.149],
            [-96.171, 19.173]
          ]
        ]
      },
      properties: {
        id: "boca-del-rio",
        name: "Boca del Río",
        source: "MVP seed boundary; replace with INEGI Marco Geoestadistico/PostGIS",
        precision: "seed"
      }
    }
  }
};

export function getSettlement(id = "boca-del-rio") {
  return SETTLEMENTS[id] || SETTLEMENTS["boca-del-rio"];
}
