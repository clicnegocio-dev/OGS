"use client";

import { useEffect, useRef, type RefObject } from "react";
import maplibregl, { type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { URBAN_LAYERS, type UrbanLayerKey } from "@/config/urban-layers";
import { isSafeHttpUrl } from "@/lib/url";

type MapPoint = {
  id: string;
  layer: string;
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
  confidence?: string;
  source: string;
  sourceUrl?: string;
  observedAt?: string;
  updatedAt?: string;
  privacy?: string;
  seed?: boolean;
  geoScope?: string;
  colonia?: string | null;
  postalCode?: string | null;
};

type UrbanMapProps = {
  center: { lat: number; lng: number };
  signals: MapPoint[];
  hazards: MapPoint[];
  boundary: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  activeLayers: Record<UrbanLayerKey, boolean>;
  is3dEnabled: boolean;
  theme: "dark" | "light";
  focusEnabled?: boolean;
};

const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: []
};

const LAYER_COLORS = Object.fromEntries(URBAN_LAYERS.map((layer) => [layer.key, layer.color])) as Record<
  UrbanLayerKey,
  string
>;
const LAYER_INFO = Object.fromEntries(
  URBAN_LAYERS.map((layer) => [layer.key, { label: layer.label, hint: layer.description }])
) as Record<UrbanLayerKey, { label: string; hint: string }>;

// Color de cada punto individual = color de su capa (coincide con la identidad de las capas).
const LAYER_COLOR_MATCH = [
  "match",
  ["get", "layer"],
  ...URBAN_LAYERS.flatMap((layer) => [layer.key, layer.color]),
  "#7a8290"
] as unknown as ExpressionSpecification;
const MAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
} as const;

// Etiquetas públicas: distinguimos reporte / oficial / inferencia / análisis (plan OIS secc. 10).
const CONFIDENCE_ES: Record<string, string> = {
  reported: "Reporte ciudadano",
  curated: "Inventario curado",
  official: "Dato oficial",
  inferred: "Inferencia / hipótesis",
  analysis: "Análisis"
};
const PRIVACY_ES: Record<string, string> = {
  public: "Público",
  aggregated: "Agregado (ubicación aproximada)"
};

export default function UrbanMap({
  center,
  signals,
  hazards,
  boundary,
  activeLayers,
  is3dEnabled,
  theme,
  focusEnabled = true
}: UrbanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initialCenterRef = useRef(center);
  const signalsRef = useRef<MapPoint[]>(signals);
  const hazardsRef = useRef<MapPoint[]>(hazards);
  const boundaryRef = useRef(boundary);
  const activeLayersRef = useRef(activeLayers);
  const is3dEnabledRef = useRef(is3dEnabled);
  const initialThemeRef = useRef(theme);

  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  useEffect(() => {
    hazardsRef.current = hazards;
  }, [hazards]);

  useEffect(() => {
    activeLayersRef.current = activeLayers;
  }, [activeLayers]);

  useEffect(() => {
    is3dEnabledRef.current = is3dEnabled;
  }, [is3dEnabled]);

  useEffect(() => {
    boundaryRef.current = boundary;
  }, [boundary]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = initialCenterRef.current;
    let flyTimeout: number | undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[initialThemeRef.current],
      center: [-35, 22],
      zoom: 1.85,
      minZoom: 1.2,
      maxZoom: 18,
      pitch: 0,
      bearing: -12,
      attributionControl: false
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      installUrbanLayers(map, activeLayersRef.current, true, initialThemeRef.current);
      // Los handlers de interacción se enlazan UNA sola vez por nombre de capa.
      // Tras cada setStyle MapLibre re-crea las capas con el mismo id, así que
      // estos listeners siguen funcionando sin necesidad de re-registrarlos.
      attachInteractionHandlers(map, popupRef);

      mapRef.current = map;
      updateBoundary(map, boundaryRef.current);
      setSignalsData(map, signalsRef.current, activeLayersRef.current);
      updateSource(map, "urban-hazards", signalsToFeatures(hazardsRef.current, "riesgo"));
      if (!focusEnabled) return;
      const target = {
        center: [initialCenter.lng, initialCenter.lat] as [number, number],
        zoom: 12.2,
        pitch: is3dEnabledRef.current ? 38 : 0,
        bearing: 0
      };
      if (prefersReducedMotion()) {
        map.jumpTo(target);
      } else {
        // Descenso cinematográfico mundo→ciudad: una pausa breve (deja asentar los primeros tiles)
        // y luego un vuelo largo y suave que asienta el rumbo (de -12° a 0°) e inclina al aterrizar.
        // El ease-in del easing da el "plano de establecimiento" sin congelar el globo.
        flyTimeout = window.setTimeout(() => {
          if (!mapRef.current) return;
          map.flyTo({ ...target, duration: 4000, curve: 1.3, essential: true, easing: easeInOutCubic });
        }, 500);
      }
    });

    return () => {
      window.clearTimeout(flyTimeout);
      map.remove();
      popupRef.current = null;
      mapRef.current = null;
    };
  }, [focusEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[theme]);
    map.once("styledata", () => {
      installUrbanLayers(map, activeLayersRef.current, is3dEnabledRef.current, theme);
      updateBoundary(map, boundaryRef.current);
      setSignalsData(map, signalsRef.current, activeLayersRef.current);
      updateSource(map, "urban-hazards", signalsToFeatures(hazardsRef.current, "riesgo"));
    });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusEnabled) return;
    const target = {
      center: [center.lng, center.lat] as [number, number],
      zoom: is3dEnabled ? 12.2 : 12.4,
      pitch: is3dEnabled ? 38 : 0,
      bearing: 0
    };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 1800, easing: easeInOutCubic });
  }, [center.lat, center.lng, is3dEnabled, focusEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    configure3d(map, is3dEnabled);
    configureGlobe(map, is3dEnabled, theme);
    map.easeTo({
      pitch: is3dEnabled ? 38 : 0,
      bearing: 0,
      duration: prefersReducedMotion() ? 0 : 1400,
      easing: easeInOutCubic
    });
  }, [is3dEnabled, theme]);

  // Sin auto-rotación perpetua: el mapa es evidencia que se lee, no un globo recon que gira.

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setSignalsData(map, signals, activeLayersRef.current);
  }, [signals]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateSource(map, "urban-hazards", signalsToFeatures(hazards, "riesgo"));
  }, [hazards]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateBoundary(map, boundary);
  }, [boundary]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setSignalsData(map, signalsRef.current, activeLayers);
    setLayerVisibility(map, ["hazards-halo", "hazards-dot"], activeLayers.riesgo);
  }, [activeLayers]);

  return <div ref={containerRef} className="urban-map" />;
}

function installUrbanLayers(
  map: maplibregl.Map,
  activeLayers: Record<UrbanLayerKey, boolean>,
  is3dEnabled: boolean,
  theme: "dark" | "light"
) {
  configure3d(map, is3dEnabled);
  configureGlobe(map, is3dEnabled, theme);
  if (!map.getSource("urban-boundary")) map.addSource("urban-boundary", { type: "geojson", data: EMPTY_COLLECTION });
  if (!map.getSource("urban-signals"))
    map.addSource("urban-signals", {
      type: "geojson",
      data: EMPTY_COLLECTION,
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 14
    });
  // Fuente sin clusterizar, gemela, para que el heatmap salga liso (no a partir de clusters).
  if (!map.getSource("urban-heat")) map.addSource("urban-heat", { type: "geojson", data: EMPTY_COLLECTION });
  if (!map.getSource("urban-hazards")) map.addSource("urban-hazards", { type: "geojson", data: EMPTY_COLLECTION });

  if (!map.getLayer("settlement-boundary-fill")) {
    map.addLayer({
      id: "settlement-boundary-fill",
      type: "fill",
      source: "urban-boundary",
      paint: {
        "fill-color": "#ee6a5b",
        "fill-opacity": theme === "dark" ? 0.08 : 0.13
      }
    });
  }

  if (!map.getLayer("settlement-boundary-line")) {
    map.addLayer({
      id: "settlement-boundary-line",
      type: "line",
      source: "urban-boundary",
      paint: {
        "line-color": "#ee6a5b",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 2.4],
        "line-opacity": 0.82,
        "line-dasharray": [2, 2]
      }
    });
  }

  // Mapa de calor: densidad de señales a vista amplia ("se ve como mapa de calor, no pins").
  if (!map.getLayer("signals-heat")) {
    map.addLayer({
      id: "signals-heat",
      type: "heatmap",
      source: "urban-heat",
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["coalesce", ["get", "sev"], 0.4],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 13, 1.4],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 12, 12, 24, 15, 38],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 14.5, 0.45, 16, 0],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(74,144,196,0)",
          0.2,
          "rgba(74,144,196,0.4)",
          0.4,
          "rgba(107,174,110,0.6)",
          0.6,
          "rgba(224,162,58,0.78)",
          0.8,
          "rgba(238,106,91,0.9)",
          1,
          "rgba(216,90,72,0.96)"
        ]
      }
    });
  }

  // Clusters: burbujas por densidad, coloreadas en la paleta de marca.
  if (!map.getLayer("signals-cluster")) {
    map.addLayer({
      id: "signals-cluster",
      type: "circle",
      source: "urban-signals",
      filter: ["has", "point_count"],
      minzoom: 12,
      paint: {
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "point_count"],
          2,
          "#4a90c4",
          15,
          "#6bae6e",
          40,
          "#e0a23a",
          120,
          "#ee6a5b"
        ],
        "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 13, 15, 18, 40, 26, 120, 34],
        "circle-opacity": 0.84,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": theme === "dark" ? "rgba(247,244,236,0.5)" : "rgba(255,255,255,0.92)"
      }
    });
  }

  if (!map.getLayer("signals-cluster-count")) {
    map.addLayer({
      id: "signals-cluster-count",
      type: "symbol",
      source: "urban-signals",
      filter: ["has", "point_count"],
      minzoom: 12,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Open Sans Semibold"],
        "text-size": 12,
        "text-allow-overlap": true
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.28)",
        "text-halo-width": 1
      }
    });
  }

  // Puntos individuales (zoom cercano): color por capa, tamaño por severidad, borde por confianza.
  if (!map.getLayer("signals-point")) {
    map.addLayer({
      id: "signals-point",
      type: "circle",
      source: "urban-signals",
      filter: ["!", ["has", "point_count"]],
      minzoom: 13,
      paint: {
        "circle-color": LAYER_COLOR_MATCH,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          ["case", ["==", ["get", "severity"], "high"], 6, ["==", ["get", "severity"], "medium"], 5, 4],
          16,
          ["case", ["==", ["get", "severity"], "high"], 11, ["==", ["get", "severity"], "medium"], 9, 7]
        ],
        "circle-opacity": [
          "case",
          // Niveles sin punto exacto (municipio/estado) se pintan más tenues = "área aproximada".
          ["==", ["get", "geoScope"], "municipio"],
          0.32,
          ["==", ["get", "geoScope"], "estado"],
          0.22,
          ["==", ["get", "confidence"], "official"],
          0.96,
          ["==", ["get", "confidence"], "inferred"],
          0.5,
          0.82
        ],
        "circle-stroke-width": ["case", ["==", ["get", "confidence"], "official"], 2, 1.2],
        "circle-stroke-color": theme === "dark" ? "rgba(8,16,22,0.85)" : "rgba(255,255,255,0.95)",
        "circle-stroke-opacity": 0.9
      }
    });
  }

  if (!map.getLayer("hazards-halo")) {
    map.addLayer({
      id: "hazards-halo",
      type: "circle",
      source: "urban-hazards",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 14, 14, 38],
        "circle-color": "#ee6a5b",
        "circle-opacity": 0.22,
        "circle-blur": 0.65
      },
      layout: { visibility: activeLayers.riesgo ? "visible" : "none" }
    });
  }

  if (!map.getLayer("hazards-dot")) {
    map.addLayer({
      id: "hazards-dot",
      type: "circle",
      source: "urban-hazards",
      paint: {
        "circle-radius": ["case", ["==", ["get", "severity"], "high"], 9, ["==", ["get", "severity"], "medium"], 7, 5],
        "circle-color": "#ee6a5b",
        "circle-opacity": 0.95,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": theme === "dark" ? "#100807" : "#ffffff"
      },
      layout: { visibility: activeLayers.riesgo ? "visible" : "none" }
    });
  }
}

// Handlers de interacción (hover/click) enlazados por NOMBRE de capa.
// Se registran UNA sola vez (en el `load` inicial), no en cada cambio de tema:
// `setStyle` re-crea las capas con el mismo id pero NO elimina estos listeners,
// así que volver a registrarlos los acumularía (fuga de handlers).
function attachInteractionHandlers(map: maplibregl.Map, popupRef: RefObject<maplibregl.Popup | null>) {
  ["signals-point", "hazards-dot"].forEach((layerId) => {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", layerId, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
        .setLngLat(coordinates)
        .setHTML(renderPopup(feature.properties || {}))
        .addTo(map);
    });
  });

  // Click en un cluster: acercar para expandirlo.
  map.on("mouseenter", "signals-cluster", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "signals-cluster", () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("click", "signals-cluster", (event) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: ["signals-cluster"] })[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = map.getSource("urban-signals") as maplibregl.GeoJSONSource | undefined;
    if (clusterId == null || !source) return;
    source
      .getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({
          center: coords,
          zoom: (zoom ?? map.getZoom() + 2) + 0.2,
          duration: prefersReducedMotion() ? 0 : 700
        });
      })
      .catch(() => {});
  });
}

function updateBoundary(map: maplibregl.Map, boundary: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null) {
  const source = map.getSource("urban-boundary") as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData(boundary || EMPTY_COLLECTION);
}

// Filtra señales por capas activas y alimenta tanto el source clusterizado como el del heatmap.
function setSignalsData(map: maplibregl.Map, signals: MapPoint[], activeLayers: Record<UrbanLayerKey, boolean>) {
  const visible = signals.filter((signal) => activeLayers[signal.layer as UrbanLayerKey] !== false);
  const collection = { type: "FeatureCollection" as const, features: signalsToFeatures(visible) };
  (map.getSource("urban-signals") as maplibregl.GeoJSONSource | undefined)?.setData(collection);
  (map.getSource("urban-heat") as maplibregl.GeoJSONSource | undefined)?.setData(collection);
}

function setLayerVisibility(map: maplibregl.Map, layerIds: string[], visible: boolean) {
  layerIds.forEach((layerId) => {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  });
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

// isSafeHttpUrl vive en @/lib/url (compartido con CpDossier/NewsBoard).

function configureGlobe(map: maplibregl.Map, enabled: boolean, theme: "dark" | "light" = "dark") {
  try {
    (map as unknown as { setProjection?: (projection: { type: "globe" | "mercator" }) => void }).setProjection?.({
      type: enabled ? "globe" : "mercator"
    });

    if (enabled) {
      map.setSky({
        "sky-color": theme === "dark" ? "#050a10" : "#eef3f0",
        "sky-horizon-blend": 0.25,
        "horizon-color": theme === "dark" ? "#0d1d28" : "#cfded9",
        "horizon-fog-blend": 0.35,
        "fog-color": theme === "dark" ? "#050a10" : "#edf4f1",
        "fog-ground-blend": 0.7
      });
    }
  } catch (error) {
    console.warn("[Ecosistema Urbano] Globe projection skipped:", error);
  }
}

function configure3d(map: maplibregl.Map, enabled: boolean) {
  try {
    if (enabled) {
      if (!map.getSource("terrain-dem")) {
        map.addSource("terrain-dem", {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15
        });
      }
      map.setTerrain({ source: "terrain-dem", exaggeration: 1.1 });

      if (!map.getSource("urban-buildings")) {
        map.addSource("urban-buildings", {
          type: "vector",
          url: "https://tiles.openfreemap.org/planet"
        });
      }

      if (!map.getLayer("urban-3d-buildings")) {
        map.addLayer({
          id: "urban-3d-buildings",
          source: "urban-buildings",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 13.5,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "render_height"], ["get", "height"], 12],
              0,
              "#1a2228",
              30,
              "#27333b",
              90,
              "#3b4853",
              180,
              "#586673"
            ],
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 12],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.52
          }
        });
      }

      map.setLayoutProperty("urban-3d-buildings", "visibility", "visible");
    } else {
      map.setTerrain(null);
      if (map.getLayer("urban-3d-buildings")) {
        map.setLayoutProperty("urban-3d-buildings", "visibility", "none");
      }
    }
  } catch (error) {
    console.warn("[Ecosistema Urbano] 3D map configuration skipped:", error);
  }
}

function updateSource(
  map: maplibregl.Map,
  sourceId: string,
  features: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[]
) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features
  });
}

function signalsToFeatures(
  points: MapPoint[],
  forcedLayer?: string
): GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[] {
  return points.map((point) => {
    const layer = forcedLayer || point.layer;
    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        // Anti-estigma/PII: las señales 'aggregated' se difuminan a ~110 m (redondeo a 3 decimales),
        // haciendo cierta la etiqueta 'ubicación aproximada' del popup en vez de decorativa.
        coordinates:
          point.privacy === "aggregated"
            ? [Math.round(point.lng * 1000) / 1000, Math.round(point.lat * 1000) / 1000]
            : [point.lng, point.lat]
      },
      properties: {
        id: point.id,
        type: point.type,
        title: point.title,
        description: point.description,
        severity: point.severity,
        sev: point.severity === "high" ? 1 : point.severity === "medium" ? 0.6 : 0.35,
        confidence: point.confidence,
        privacy: point.privacy,
        source: point.source,
        sourceUrl: point.sourceUrl,
        observedAt: point.observedAt,
        updatedAt: point.updatedAt,
        seed: point.seed,
        geoScope: point.geoScope,
        colonia: point.colonia,
        postalCode: point.postalCode,
        layer,
        layerLabel: LAYER_INFO[layer as UrbanLayerKey]?.label,
        layerHint: LAYER_INFO[layer as UrbanLayerKey]?.hint,
        color: LAYER_COLORS[layer as UrbanLayerKey] || LAYER_COLORS.urbano
      }
    };
  });
}

function renderPopup(properties: Record<string, unknown>) {
  const title = escapeHtml(String(properties.title || "Señal urbana"));
  const description = properties.description ? escapeHtml(String(properties.description)) : "";
  const layerLabel = properties.layerLabel ? escapeHtml(String(properties.layerLabel)) : "";
  const hint = properties.layerHint ? escapeHtml(String(properties.layerHint)) : "";
  const source = escapeHtml(String(properties.source || "Fuente no declarada"));
  const confidenceKey = String(properties.confidence || "");
  // 'reported' se comparte entre reporte ciudadano y prensa; si la fuente es un medio, etiquétalo como tal.
  const confidence =
    confidenceKey === "reported" && /medio/i.test(String(properties.source || ""))
      ? "Reporte de medio (no verificado)"
      : CONFIDENCE_ES[confidenceKey] || (confidenceKey ? escapeHtml(confidenceKey) : "");
  const privacy = PRIVACY_ES[String(properties.privacy || "")] || "";
  const date = properties.updatedAt || properties.observedAt;
  const dateText = date ? escapeHtml(String(date).slice(0, 10)) : "";
  const rawUrl = String(properties.sourceUrl || "");
  const link = isSafeHttpUrl(rawUrl)
    ? `<a class="popup-link" href="${escapeAttribute(rawUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente</a>`
    : "";
  // Distingue las señales SEMILLA fabricadas (demo) de la evidencia real, sin tocar el dato.
  const seedBadge = properties.seed
    ? `<span class="popup-seed" style="display:inline-block;margin-bottom:6px;padding:2px 8px;border-radius:999px;background:#ee6a5b;color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">Demo · señal semilla</span>`
    : "";

  // Ubicación según el nivel de atribución: colonia (punto) o etiqueta de municipio/estado, + CP.
  const geoScope = String(properties.geoScope || "");
  const colonia = properties.colonia ? escapeHtml(String(properties.colonia)) : "";
  const postalCode = properties.postalCode ? escapeHtml(String(properties.postalCode)) : "";
  const place =
    geoScope === "municipio" ? "Nivel municipio (sin colonia)" : geoScope === "estado" ? "Nivel estado" : colonia;
  const placeText = [place, postalCode ? `CP ${postalCode}` : ""].filter(Boolean).join(" · ");

  const meta = [
    placeText ? `<div><dt>Ubicación</dt><dd>${placeText}</dd></div>` : "",
    confidence ? `<div><dt>Confianza</dt><dd>${confidence}</dd></div>` : "",
    privacy ? `<div><dt>Privacidad</dt><dd>${privacy}</dd></div>` : "",
    `<div><dt>Fuente</dt><dd>${source}${dateText ? ` · ${dateText}` : ""}</dd></div>`
  ].join("");

  return `
    <div class="map-popup">
      ${layerLabel ? `<span class="popup-layer">${layerLabel}</span>` : ""}
      ${seedBadge}
      <strong>${title}</strong>
      ${description ? `<div class="popup-desc">${description}</div>` : ""}
      ${hint ? `<div class="popup-hint"><span>Por qué importa</span>${hint}</div>` : ""}
      <dl class="popup-meta">${meta}</dl>
      ${link}
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
