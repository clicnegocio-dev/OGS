"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { UrbanLayerControl } from "@/components/UrbanLayerControl";
import { RadiusControl } from "@/components/RadiusControl";
import { CpDossier } from "@/components/CpDossier";
import { DEFAULT_ACTIVE_LAYERS, URBAN_LAYERS, type UrbanLayerKey } from "@/config/urban-layers";
import { getSettlement } from "@/config/settlements";
import { distanceKm } from "@/lib/geo";
import { buildCpDossier } from "@/lib/news";
import type { UrbanMapSignal } from "@/types/urban";
import type { MunicipalProfile } from "@/lib/socioeconomic";

const UrbanMap = dynamic(() => import("@/components/UrbanMap"), {
  ssr: false,
  // Placeholder mientras carga el chunk de MapLibre (evita un hueco en blanco / CLS).
  loading: () => <div className="urban-map is-loading" aria-busy="true" />
});

type CityContext = {
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
};

type UrbanHazard = {
  id: string;
  layer: "riesgo";
  type: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
  confidence?: string;
  privacy?: string;
  source: string;
  sourceUrl?: string;
  observedAt?: string;
};

type HydricWeather = {
  risk: { level: "low" | "medium" | "high"; label: string; reason: string };
  next24h: { precipitationMm: number };
  heat?: { temperatureC: number; apparentC: number; level: string } | null;
  air?: { usAqi: number; pm25: number; level: string; label: string } | null;
  source: string;
};

export function UrbanHero({ settlementSlug }: { settlementSlug?: string }) {
  // getSettlement devuelve una referencia de módulo ESTABLE (constante), así que configuredSettlement
  // y el `city` derivado son estables entre renders: el efecto de fetch NO se re-dispara solo.
  const configuredSettlement = getSettlement(settlementSlug || "boca-del-rio");
  const city = useMemo<CityContext>(
    () => ({
      lat: configuredSettlement.center.lat,
      lng: configuredSettlement.center.lng,
      city: configuredSettlement.name,
      region: configuredSettlement.stateName,
      country: configuredSettlement.country
    }),
    [configuredSettlement]
  );

  const [signals, setSignals] = useState<UrbanMapSignal[]>([]);
  const [hazards, setHazards] = useState<UrbanHazard[]>([]);
  const [boundary, setBoundary] = useState<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [weather, setWeather] = useState<HydricWeather | null>(null);
  const [profile, setProfile] = useState<MunicipalProfile | null>(null);
  const [newsSummary, setNewsSummary] = useState<{ total: number; mapped: number; vintage: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // #A6 (auditoría): qué fuentes NO respondieron (parcial). Antes solo se avisaba si fallaban TODAS,
  // y una fuente caída se veía como "hay menos señales" — contra el lema "Sin datos ≠ sin problema".
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [is3dEnabled, setIs3dEnabled] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeLayers, setActiveLayers] = useState<Record<UrbanLayerKey, boolean>>(DEFAULT_ACTIVE_LAYERS);
  // El panel arranca COLAPSADO: el mapa (la data) toma el centro; el usuario lo expande cuando lo pide.
  const [panelsExpanded, setPanelsExpanded] = useState(false);
  // Radio de acotación ("Todo" = null = ver todo lo que pertenece al municipio).
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  // Código postal en foco (llega vía ?cp, p.ej. desde el tablero de lista): recentra y acota el mapa.
  const [focusCp, setFocusCp] = useState<string | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const panelsToggled = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Un AbortController por ejecución: al desmontar o cambiar de asentamiento ABORTA de verdad las
    // peticiones (antes solo se marcaba `cancelled` y seguían ejecutándose en el backend).
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(false);
    setFailedSources([]);

    const settlementId = configuredSettlement.id;
    const params = new URLSearchParams({
      lat: String(city.lat),
      lng: String(city.lng),
      radiusKm: "35",
      city: city.city,
      settlement: settlementId
    });
    // Hazards: radio amplio para contexto regional (no leer "0 = sin riesgo"). El riesgo local real
    // es hídrico (weather).
    const hazardParams = new URLSearchParams({ lat: String(city.lat), lng: String(city.lng), radiusKm: "250" });

    async function fetchJson(url: string) {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
      return response.json();
    }

    Promise.allSettled([
      fetchJson(`/api/urban/signals?${params.toString()}`),
      fetchJson(`/api/urban/hazards?${hazardParams.toString()}`),
      fetchJson(`/api/urban/denue?settlement=${settlementId}&mode=area&condition=todos&detail=map`),
      fetchJson(`/api/urban/boundary?settlement=${settlementId}&method=denue`),
      fetchJson(`/api/urban/weather?lat=${city.lat}&lng=${city.lng}&city=${encodeURIComponent(city.city)}`),
      fetchJson(`/api/urban/profile?settlement=${settlementId}`),
      fetchJson(`/api/urban/news?settlement=${settlementId}`)
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const [signalsResult, hazardsResult, denueResult, boundaryResult, weatherResult, profileResult, newsResult] =
        results;

      const seedSignals = signalsResult.status === "fulfilled" ? signalsResult.value.signals || [] : [];
      const denueSignals = denueResult.status === "fulfilled" ? denueResult.value.signals || [] : [];
      const newsSignals = newsResult.status === "fulfilled" ? newsResult.value.signals || [] : [];
      setSignals([...seedSignals, ...denueSignals, ...newsSignals]);
      if (hazardsResult.status === "fulfilled") setHazards(hazardsResult.value.hazards || []);
      if (weatherResult.status === "fulfilled" && !weatherResult.value.error) setWeather(weatherResult.value);
      if (profileResult.status === "fulfilled" && !profileResult.value.error) setProfile(profileResult.value);
      if (newsResult.status === "fulfilled" && !newsResult.value.error) {
        setNewsSummary({
          total: newsResult.value.total,
          mapped: newsResult.value.mapped,
          vintage: newsResult.value.vintage
        });
      }
      if (boundaryResult.status === "fulfilled") {
        setBoundary(boundaryResult.value.boundary || null);
        const denueWarning = denueResult.status === "fulfilled" ? denueResult.value.completeness?.warning : null;
        setDataWarning(boundaryResult.value.completeness?.warning || denueWarning || null);
      }

      // Fallos por fuente: nombramos las caídas (parcial) para no presentar "menos datos" como
      // "sin problema". Si fallaron TODAS, además marcamos loadError (mensaje de error total).
      const LABELS = ["señales base", "riesgos", "comercios y servicios", "límite", "clima", "perfil", "noticias"];
      const failed = results
        .map((r, i) => (r.status === "rejected" ? LABELS[i] : null))
        .filter((l): l is string => l !== null);
      setFailedSources(failed);
      setLoadError(failed.length === results.length);
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [configuredSettlement, city]);

  // Conversación con el tablero/⌘K: ?cp=... enfoca un código postal (recentra + acota a 2 km). #A4
  // (auditoría): antes se leía SOLO al montar (window.location.search en un efecto []), así que elegir
  // una colonia en ⌘K estando YA en la página no enfocaba nada (router.push no remonta). Con
  // useSearchParams el efecto reacciona al cambio de URL en navegación cliente (y en back/forward).
  const cpParam = searchParams.get("cp");
  useEffect(() => {
    if (cpParam) {
      setFocusCp(cpParam);
      setRadiusKm(2);
      setPanelsExpanded(true); // que el dossier del CP sea visible al llegar por ?cp
    }
  }, [cpParam]);

  // Disclosure accesible: al expandir/colapsar, mueve el foco al control recién montado para no
  // perderlo en <body>. Salta el render inicial (el panel arranca colapsado en la carga) para no
  // robar el foco al cargar la página.
  useEffect(() => {
    if (!panelsToggled.current) {
      panelsToggled.current = true;
      return;
    }
    if (panelsExpanded) collapseRef.current?.focus();
    else launcherRef.current?.focus();
  }, [panelsExpanded]);

  // Centro efectivo del mapa: el centroide del CP en foco (derivado de sus señales) o el del municipio.
  const focusCenter = useMemo(() => {
    if (!focusCp) return null;
    const pts = signals.filter((signal) => signal.postalCode === focusCp);
    if (pts.length === 0) return null;
    return {
      lat: pts.reduce((sum, s) => sum + s.lat, 0) / pts.length,
      lng: pts.reduce((sum, s) => sum + s.lng, 0) / pts.length
    };
  }, [signals, focusCp]);

  const mapCenter = useMemo(() => focusCenter ?? { lat: city.lat, lng: city.lng }, [focusCenter, city]);

  // Acotado por radio: "Todo" (null) muestra todo lo que pertenece al municipio; un radio filtra por
  // distancia al CENTRO EFECTIVO (el municipio, o el CP en foco). No aplica a hazards (contexto regional).
  const radiusFiltered = useMemo(
    () => (radiusKm == null ? signals : signals.filter((signal) => distanceKm(mapCenter, signal) <= radiusKm)),
    [signals, radiusKm, mapCenter]
  );

  const layerCounts = useMemo(() => {
    const counts = {} as Record<UrbanLayerKey, number>;
    URBAN_LAYERS.forEach((layer) => {
      counts[layer.key] = 0;
    });
    radiusFiltered.forEach((signal) => {
      const key = signal.layer as UrbanLayerKey;
      // Guarda: un layer inesperado del backend haría counts[key]+=1 = NaN. Solo contamos claves conocidas.
      if (key in counts) counts[key] += 1;
    });
    counts.riesgo = hazards.length;
    return counts;
  }, [radiusFiltered, hazards]);

  const visibleEntityCount = useMemo(
    () =>
      radiusFiltered.filter((signal) => activeLayers[signal.layer as UrbanLayerKey]).length +
      (activeLayers.riesgo ? hazards.length : 0),
    [radiusFiltered, hazards, activeLayers]
  );

  // Dossier del CP en foco (helper compartido con el tablero → dossiers idénticos por construcción).
  const cpDossier = useMemo(() => buildCpDossier(signals, focusCp), [signals, focusCp]);

  const profileLines = useMemo(() => {
    if (!profile) return [];
    const { descriptive, diagnostic } = profile.dimensions;
    const lines: string[] = [];
    if (descriptive.population) {
      const value = descriptive.population.value;
      lines.push(`Población ${typeof value === "number" ? value.toLocaleString("es-MX") : value}`);
    }
    if (descriptive.povertyRate) lines.push(`${descriptive.povertyRate.value}% en pobreza`);
    if (diagnostic.deprivations.length) lines.push(`Carencia principal: ${diagnostic.deprivations[0].label}`);
    return lines;
  }, [profile]);

  function toggleLayer(key: UrbanLayerKey) {
    setActiveLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function setAllLayers(active: boolean) {
    setActiveLayers(
      URBAN_LAYERS.reduce(
        (next, layer) => {
          next[layer.key] = active;
          return next;
        },
        {} as Record<UrbanLayerKey, boolean>
      )
    );
  }

  const activeLayerCount = URBAN_LAYERS.filter((layer) => activeLayers[layer.key]).length;

  // Lecturas en vivo: viven dentro del panel expandido. Extraídas para no duplicarlas al alternar
  // entre el lanzador colapsado y el riel.
  const liveReadouts = (
    <div className="hero-readouts" role="group" aria-label="Lecturas de datos en vivo" tabIndex={0}>
      {isLoading ? <p className="data-warning">Cargando señales…</p> : null}
      {loadError ? (
        <p className="data-warning">No se pudieron cargar las señales en este momento. Reintenta en unos segundos.</p>
      ) : null}
      {!loadError && failedSources.length > 0 ? (
        <p className="data-warning" role="status">
          Faltan fuentes que no respondieron: {failedSources.join(", ")}. Lo visible está incompleto — no es &ldquo;sin
          problema&rdquo;.
        </p>
      ) : null}
      {weather ? (
        <Metric
          label="Riesgo hídrico"
          value={weather.risk.label}
          note={weather.risk.reason}
          tone={weather.risk.level === "high" ? "alert" : "default"}
        />
      ) : null}
      {dataWarning ? <p className="data-warning">{dataWarning}</p> : null}
      {weather ? (
        <div className="map-conditions">
          <span className="cond-title">Ambiente ahora</span>
          <div className="cond-row">
            {weather.heat ? (
              <span className="cond-pill">
                <b>{Math.round(weather.heat.temperatureC)}°C</b> temp
              </span>
            ) : null}
            {weather.air ? (
              <span className="cond-pill">
                Aire <b>{weather.air.label}</b> · AQI {weather.air.usAqi}
              </span>
            ) : null}
            <span className="cond-pill">
              <b>{weather.next24h.precipitationMm} mm</b> lluvia 24h
            </span>
          </div>
          <span className="cond-src">Open-Meteo · en vivo</span>
        </div>
      ) : null}
      {profile ? <ProfilePanel profile={profile} /> : null}
      {newsSummary && newsSummary.total > 0 ? (
        <div className="map-conditions" aria-label="Señales en medios locales">
          <span className="cond-title">Señales en medios · {newsSummary.vintage}</span>
          <div className="cond-row">
            <span className="cond-pill">
              <b>{newsSummary.total}</b> señales periodísticas
            </span>
            <span className="cond-pill">
              <b>{newsSummary.mapped}</b> ubicadas por colonia
            </span>
          </div>
          <span className="cond-src">XEU (medio) · reporte, no hecho verificado</span>
          <a
            className="cond-board-link"
            href={`/${configuredSettlement.id}/noticias${focusCp ? `?cp=${focusCp}` : ""}`}
            style={{
              display: "inline-block",
              marginTop: "10px",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--accent)",
              textDecoration: "none"
            }}
          >
            {focusCp ? `Ver CP ${focusCp} en lista →` : "Ver todas en lista →"}
          </a>
        </div>
      ) : null}
      <p className="data-coverage">
        <b>Medido en vivo:</b> clima, aire, sismo, servicios. <b>Oficial por corte:</b> perfil socioeconómico
        (DataMéxico). <b>Señales de medios:</b> XEU (reporte). <b>En integración (OIS):</b> Censo por AGEB, banquetas,
        inundación histórica. <b>Mapa de calor:</b> densidad de señales (incluye demo y prensa sin verificar), no
        incidencia verificada.{" "}
        <Link href="/fuentes" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
          Fuentes →
        </Link>{" "}
        <a
          href={`/${configuredSettlement.id}/analisis`}
          style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}
        >
          Análisis →
        </a>
      </p>
    </div>
  );

  return (
    <main className="hero-shell" data-ui-theme={theme} data-panels={panelsExpanded ? "open" : "collapsed"}>
      <div className="map-stage" id="mapa" role="region" aria-label="Mapa de señales urbanas">
        <UrbanMap
          center={mapCenter}
          signals={radiusFiltered}
          hazards={hazards}
          boundary={boundary}
          activeLayers={activeLayers}
          is3dEnabled={is3dEnabled}
          theme={theme}
        />
      </div>

      {/* Regiones vivas persistentes: anuncian carga/errores/riesgo alto aunque el panel esté
          colapsado (estado por defecto). Únicas fuentes de anuncio: los mensajes del panel son visuales. */}
      <div className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Cargando señales…" : loadError ? "" : "Señales cargadas."}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {loadError
          ? "No se pudieron cargar las señales."
          : weather && weather.risk.level === "high"
            ? `Riesgo hídrico alto: ${weather.risk.reason}`
            : ""}
      </div>

      <section className="hero-copy" aria-label="Ecosistema Urbano">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {`${city.city}, ${city.region}`}
        </div>
        <h1 className="hero-title">{`${city.city}, vista como un sistema vivo.`}</h1>
        <p className="hero-sub">
          Nada está aislado. Mira las <em>señales del territorio</em> antes de decidir vivir, invertir o participar.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={() => setPanelsExpanded(true)}>
            Explorar señales
          </button>
          <a className="btn btn-ghost" href="#participa">
            Reportar una señal
          </a>
        </div>
        {focusCp ? (
          <div className="cp-focus" role="status">
            <span className="cp-focus-label">
              Código postal <b>{focusCp}</b> · radio 2 km
            </span>
            <button
              type="button"
              className="cp-focus-clear"
              onClick={() => {
                setFocusCp(null);
                setRadiusKm(null);
              }}
            >
              Quitar
            </button>
          </div>
        ) : null}
        <p className="hero-lema">
          <span className="lema-pulse" aria-hidden="true" />
          No es una queja, es una señal.
        </p>
      </section>

      <div className="map-toolbar" aria-label="Controles del mapa">
        <button
          className="theme-mode"
          type="button"
          aria-pressed={theme === "light"}
          onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
        >
          <span className="mode-kicker">Tema</span>
          <strong>{theme === "dark" ? "Oscuro" : "Claro"}</strong>
        </button>
        <button
          className={`map-mode ${is3dEnabled ? "is-active" : ""}`}
          type="button"
          aria-pressed={is3dEnabled}
          onClick={() => setIs3dEnabled((value) => !value)}
        >
          <span className="mode-kicker">Vista</span>
          <strong>{is3dEnabled ? "Globo 3D" : "Mapa 2D"}</strong>
        </button>
        <div className="map-status">
          <span>{visibleEntityCount}</span>
          señales visibles
        </div>
      </div>

      {panelsExpanded ? (
        <aside className="hero-panels" aria-label="Panel de datos urbanos">
          <div className="panel-rail-head">
            <span className="rail-head-eyebrow">
              <span className="rail-head-dot" aria-hidden="true" />
              Panel en vivo
            </span>
            <button
              type="button"
              className="rail-collapse"
              ref={collapseRef}
              onClick={() => setPanelsExpanded(false)}
              aria-label="Ocultar panel de datos"
            >
              Ocultar
              <span className="chevron chevron-down" aria-hidden="true" />
            </button>
          </div>

          {cpDossier ? (
            <CpDossier
              cp={cpDossier.cp}
              colonia={cpDossier.colonia}
              municipioName={city.city}
              total={cpDossier.total}
              confidence={cpDossier.confidence}
              byType={cpDossier.byType}
              recent={cpDossier.recent}
              profileLines={profileLines}
              listHref={`/${configuredSettlement.id}/noticias?cp=${cpDossier.cp}`}
              onClear={() => {
                setFocusCp(null);
                setRadiusKm(null);
              }}
            />
          ) : null}

          <UrbanLayerControl
            activeLayers={activeLayers}
            counts={layerCounts}
            onToggle={toggleLayer}
            onSetAll={setAllLayers}
          />

          <RadiusControl radiusKm={radiusKm} onChange={setRadiusKm} count={visibleEntityCount} />

          {liveReadouts}
        </aside>
      ) : (
        <button
          type="button"
          className="panel-launcher"
          ref={launcherRef}
          onClick={() => setPanelsExpanded(true)}
          aria-expanded={false}
        >
          <span className="launcher-glyph" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="launcher-copy">
            <strong>Explorar datos</strong>
            <span>{isLoading ? "Cargando señales…" : `${activeLayerCount} capas · ${visibleEntityCount} señales`}</span>
          </span>
          <span className="chevron chevron-up" aria-hidden="true" />
        </button>
      )}
    </main>
  );
}

function ProfilePanel({ profile }: { profile: MunicipalProfile }) {
  const { descriptive, diagnostic, predictive, prescriptive } = profile.dimensions;
  const trend = predictive.povertyTrend;
  // Guarda defensiva de longitud: aunque buildTrend garantiza >=2 puntos, no asumimos el invariante
  // del servidor en el cliente (un payload malformado no debe tumbar el render sin error boundary).
  const trendNote =
    trend && trend.series.length >= 2 && descriptive.povertyRate
      ? `Pobreza ${trend.direction === "rising" ? "al alza" : trend.direction === "falling" ? "a la baja" : "estable"} ${
          trend.deltaPctPoints >= 0 ? "+" : ""
        }${trend.deltaPctPoints} pts (${trend.series[0].year}–${trend.series[trend.series.length - 1].year}).`
      : undefined;

  return (
    <div className="map-conditions" aria-label="Perfil socioeconómico oficial">
      <span className="cond-title">Perfil socioeconómico · {profile.source.vintage}</span>
      {descriptive.population ? (
        <Metric
          label="Población"
          value={descriptive.population.value}
          note={
            descriptive.povertyRate
              ? `${descriptive.povertyRate.value}% en pobreza. ${trendNote ?? ""}`.trim()
              : undefined
          }
        />
      ) : null}
      {descriptive.indicators.length ? (
        <div className="cond-row">
          {descriptive.indicators.map((indicator) => (
            <span className="cond-pill" key={indicator.key} title={indicator.label}>
              {shortIndicator(indicator.key)} <b>{indicator.value}%</b>
            </span>
          ))}
        </div>
      ) : null}
      {diagnostic.deprivations.length ? (
        <>
          <span className="cond-title">Carencias que explican la zona</span>
          <div className="cond-row">
            {diagnostic.deprivations.slice(0, 3).map((dep) => (
              <span className="cond-pill" key={dep.key} title={dep.label}>
                {shortDeprivation(dep.key)} <b>{dep.value}%</b>
              </span>
            ))}
          </div>
        </>
      ) : null}
      {prescriptive.priority ? <p className="metric-note">{prescriptive.priority.signal}</p> : null}
      <span className="cond-src">{profile.source.name} (INEGI · CONEVAL)</span>
    </div>
  );
}

const DEPRIVATION_SHORT: Record<string, string> = {
  "servicios-basicos": "Servicios básicos",
  salud: "Salud",
  educacion: "Rezago educativo",
  "calidad-vivienda": "Calidad vivienda",
  "seguridad-social": "Seguridad social"
};

function shortDeprivation(key: string): string {
  return DEPRIVATION_SHORT[key] || key;
}

const INDICATOR_SHORT: Record<string, string> = {
  internet: "Internet en casa",
  "inseguridad-gasto": "Gasto vs delito"
};

function shortIndicator(key: string): string {
  return INDICATOR_SHORT[key] || key;
}

function Metric({
  label,
  value,
  note,
  tone = "default"
}: {
  label: string;
  value: number | string;
  note?: string;
  tone?: "default" | "alert";
}) {
  return (
    <div className={`metric-card${tone === "alert" ? " is-alert" : ""}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{typeof value === "number" ? value.toLocaleString("es-MX") : value}</span>
      {note ? <span className="metric-note">{note}</span> : null}
    </div>
  );
}
