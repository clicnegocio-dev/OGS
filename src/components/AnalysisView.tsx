"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { linearFit, type Fit } from "@/lib/stats";

// Vista de Análisis (pilar diagnóstico/predictivo de la 4D). Alcance DERIVADO por spec-perfiles-eu-ogs_v1
// (§7): perfil Ciudadano + objeto ciudad + regla de dato honesto → EXPLORATORIO ahora, robusto = OIS.
// - Relación: correlación entre tipos de señal por código postal (scatter + ajuste lineal + R²/N).
// - Tendencia: serie oficial de pobreza (CONEVAL) — tendencia observada, no pronóstico.
// - OIS: placeholder honesto de la regresión robusta por AGEB.
// Gráficos SVG hechos a mano (sin librería): coherente con "nada decorativo" y cero dependencias.

export type CpDatum = { cp: string; colonia: string | null; total: number; counts: Record<string, number> };

type TrendPoint = { year: number; pct: number };
type ProfileResp = {
  dimensions?: {
    predictive?: { povertyTrend?: { series?: TrendPoint[]; direction?: string; deltaPctPoints?: number } };
  };
  source?: { vintage?: string; name?: string };
};


const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function AnalysisView({
  settlementId,
  settlementName,
  stateName,
  cpData
}: {
  settlementId: string;
  settlementName: string;
  stateName: string;
  cpData: CpDatum[];
}) {
  const [mode, setMode] = useState<"relacion" | "tendencia">("relacion");

  const types = useMemo(() => {
    const t = new Map<string, number>();
    for (const d of cpData) for (const [k, v] of Object.entries(d.counts)) t.set(k, (t.get(k) ?? 0) + v);
    return [...t.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  }, [cpData]);

  return (
    <main className="an">
      <header className="an-head">
        <div className="an-nav">
          <Link className="an-back" href={`/${settlementId}`}>
            ← Mapa
          </Link>
          <Link className="an-back" href={`/${settlementId}/noticias`}>
            Tablero
          </Link>
        </div>
        <h1 className="an-title">Análisis · {settlementName}</h1>
        <p className="an-sub">
          El pilar cuantitativo: <b>¿qué se relaciona con qué?</b> y <b>¿hacia dónde va?</b> — la tesis
          &ldquo;nada está aislado&rdquo; hecha número. Es <b>exploratorio</b>: el análisis robusto por
          manzana (AGEB) llega con la plataforma OIS.
        </p>
        <div
          className="an-tabs"
          role="tablist"
          aria-label="Modo de análisis"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setMode((m) => (m === "relacion" ? "tendencia" : "relacion"));
            }
          }}
        >
          <button
            type="button"
            role="tab"
            id="an-tab-relacion"
            aria-controls="an-tabpanel"
            aria-selected={mode === "relacion"}
            tabIndex={mode === "relacion" ? 0 : -1}
            className={`an-tab ${mode === "relacion" ? "is-active" : ""}`}
            onClick={() => setMode("relacion")}
          >
            Relación entre zonas
          </button>
          <button
            type="button"
            role="tab"
            id="an-tab-tendencia"
            aria-controls="an-tabpanel"
            aria-selected={mode === "tendencia"}
            tabIndex={mode === "tendencia" ? 0 : -1}
            className={`an-tab ${mode === "tendencia" ? "is-active" : ""}`}
            onClick={() => setMode("tendencia")}
          >
            Tendencia (oficial)
          </button>
        </div>
      </header>

      <div
        id="an-tabpanel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={mode === "relacion" ? "an-tab-relacion" : "an-tab-tendencia"}
      >
        {mode === "relacion" ? <RelacionPanel cpData={cpData} types={types} /> : <TendenciaPanel settlementId={settlementId} />}
      </div>

      <section className="an-ois" aria-label="Análisis robusto (OIS)">
        <p className="an-ois-kicker">Lo que llega con OIS</p>
        <p>
          <b>Regresión robusta por AGEB.</b> Con el dato oficial por manzana (Censo, Entorno Urbano,
          CENAPRED) —cientos de observaciones y varias capas emparejadas— OIS podrá correr regresión
          multi-capa real (p. ej. inundación en función de elevación, drenaje, lluvia e historial),
          explicable y con incertidumbre declarada. Lo de arriba es <b>exploratorio</b> con los datos
          que EU ya tiene; esto es el modelo. Ver <code>docs/spec-perfiles-eu-ogs_v1.md</code>.
        </p>
        <p className="an-ois-src">{stateName} · Fase 2 (OIS)</p>
      </section>
    </main>
  );
}

function RelacionPanel({ cpData, types }: { cpData: CpDatum[]; types: string[] }) {
  const [xSel, setXSel] = useState("");
  const [ySel, setYSel] = useState("");
  const xType = xSel || types[0] || "";
  const yType = ySel || types[1] || types[0] || "";

  const points = useMemo(
    () =>
      cpData.map((d) => ({
        x: d.counts[xType] ?? 0,
        y: d.counts[yType] ?? 0,
        label: d.colonia || d.cp
      })),
    [cpData, xType, yType]
  );
  const fit = useMemo(() => linearFit(points), [points]);
  // Evita R² espurio: exige >= 4 zonas y dos variables distintas (con 2 puntos R² siempre da 1.00).
  const fitOk = points.length >= 4 && xType !== yType && fit !== null && !fit.degenerate;

  if (cpData.length < 2) {
    return <p className="an-empty">Se necesitan al menos 2 códigos postales con señales para relacionar.</p>;
  }

  return (
    <section className="an-panel" aria-label="Relación entre zonas">
      <div className="an-controls">
        <label>
          <span>Eje X</span>
          <select value={xType} onChange={(e) => setXSel(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="an-vs">vs</span>
        <label>
          <span>Eje Y</span>
          <select value={yType} onChange={(e) => setYSel(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Scatter points={points} fit={fitOk ? fit : null} xLabel={xType} yLabel={yType} />

      <div className="an-stats">
        <Stat label="N (códigos postales)" value={String(points.length)} />
        <Stat label="R²" value={fitOk && fit ? fit.r2.toFixed(2) : "—"} />
        <Stat label="Pendiente" value={fitOk && fit ? fit.slope.toFixed(2) : "—"} />
        <Stat
          label="Lectura"
          value={
            fitOk && fit
              ? fit.r2 >= 0.5
                ? "co-ocurren"
                : fit.r2 >= 0.2
                  ? "relación débil"
                  : "sin relación clara"
              : "—"
          }
        />
      </div>

      {!fitOk ? (
        <p className="an-caveat">
          {xType === yType
            ? "Elige dos tipos distintos para relacionarlos."
            : `N = ${points.length}: insuficiente para un ajuste fiable (se necesitan ≥ 4 zonas). Se muestran los puntos, sin R².`}
        </p>
      ) : null}

      <p className="an-caveat">
        Cada punto es un código postal. <b>N pequeño</b>, <b>fuente única</b> (prensa, no verificada) y{" "}
        <b>correlación ≠ causalidad</b>: esto sugiere co-ocurrencia por zona, no una causa. El análisis
        robusto por AGEB llega con OIS.
      </p>
    </section>
  );
}

function TendenciaPanel({ settlementId }: { settlementId: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [series, setSeries] = useState<TrendPoint[]>([]);
  const [direction, setDirection] = useState<string>("");
  const [delta, setDelta] = useState<number | null>(null);
  const [vintage, setVintage] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/urban/profile?settlement=${settlementId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ProfileResp) => {
        const trend = data?.dimensions?.predictive?.povertyTrend;
        const rawSeries = trend?.series;
        const s = Array.isArray(rawSeries) ? rawSeries.filter((p) => Number.isFinite(p?.pct)) : [];
        setSeries(s);
        setDirection(trend?.direction ?? "");
        setDelta(typeof trend?.deltaPctPoints === "number" ? trend.deltaPctPoints : null);
        setVintage(data?.source?.vintage ?? "");
        setState("ok");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [settlementId]);

  if (state === "loading") return <p className="an-empty">Cargando serie oficial…</p>;
  if (state === "error") return <p className="an-empty">No se pudo cargar la serie socioeconómica.</p>;
  if (series.length < 2) return <p className="an-empty">Sin serie temporal suficiente para una tendencia.</p>;

  const dirLabel = direction === "rising" ? "al alza" : direction === "falling" ? "a la baja" : "estable";

  return (
    <section className="an-panel" aria-label="Tendencia de pobreza">
      <p className="an-panel-title">Pobreza (CONEVAL) · {series[0].year}–{series[series.length - 1].year}</p>
      <LineChart series={series} />
      <div className="an-stats">
        <Stat label="Puntos" value={String(series.length)} />
        <Stat label="Dirección" value={dirLabel} />
        <Stat label="Δ (pts)" value={delta != null ? `${delta >= 0 ? "+" : ""}${delta}` : "—"} />
        {vintage ? <Stat label="Corte" value={vintage} /> : null}
      </div>
      <p className="an-caveat">
        Es una <b>tendencia observada</b> sobre cortes oficiales, <b>no un pronóstico</b>. La proyección
        modelada llega con OIS y su histórico.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="an-stat">
      <span className="an-stat-value">{value}</span>
      <span className="an-stat-label">{label}</span>
    </div>
  );
}

function Scatter({
  points,
  fit,
  xLabel,
  yLabel
}: {
  points: { x: number; y: number; label: string }[];
  fit: Fit | null;
  xLabel: string;
  yLabel: string;
}) {
  const W = 480;
  const H = 300;
  const pl = 46;
  const pr = 18;
  const pt = 16;
  const pb = 42;
  const maxX = Math.max(1, ...points.map((p) => p.x));
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const sx = (x: number) => pl + (x / maxX) * (W - pl - pr);
  const sy = (y: number) => H - pb - (y / maxY) * (H - pt - pb);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-svg" role="img" aria-label={`Dispersión de ${xLabel} contra ${yLabel} por código postal`}>
      <defs>
        <clipPath id="an-clip">
          <rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} />
        </clipPath>
      </defs>
      <line x1={pl} y1={pt} x2={pl} y2={H - pb} className="an-axis" />
      <line x1={pl} y1={H - pb} x2={W - pr} y2={H - pb} className="an-axis" />
      {fit && !fit.degenerate ? (
        <line
          x1={sx(0)}
          y1={sy(clamp(fit.intercept, -maxY * 4, maxY * 4))}
          x2={sx(maxX)}
          y2={sy(clamp(fit.intercept + fit.slope * maxX, -maxY * 4, maxY * 4))}
          className="an-fit"
          clipPath="url(#an-clip)"
        />
      ) : null}
      {points.map((p, i) => (
        <circle key={`${p.label}-${i}`} cx={sx(p.x)} cy={sy(p.y)} r={5} className="an-dot">
          <title>{`${p.label}: ${xLabel} ${p.x}, ${yLabel} ${p.y}`}</title>
        </circle>
      ))}
      <text x={(pl + (W - pr)) / 2} y={H - 10} className="an-axis-label" textAnchor="middle">
        {xLabel} →
      </text>
      <text
        x={15}
        y={(pt + (H - pb)) / 2}
        className="an-axis-label"
        textAnchor="middle"
        transform={`rotate(-90 15 ${(pt + (H - pb)) / 2})`}
      >
        {yLabel} →
      </text>
    </svg>
  );
}

function LineChart({ series }: { series: TrendPoint[] }) {
  const W = 480;
  const H = 260;
  const pl = 46;
  const pr = 18;
  const pt = 18;
  const pb = 36;
  const years = series.map((s) => s.year);
  const minYr = Math.min(...years);
  const maxYr = Math.max(...years);
  const maxV = Math.max(1, ...series.map((s) => s.pct)) * 1.12;
  const sx = (yr: number) => pl + (maxYr === minYr ? 0.5 : (yr - minYr) / (maxYr - minYr)) * (W - pl - pr);
  const sy = (v: number) => H - pb - (v / maxV) * (H - pt - pb);
  const path = series.map((s, i) => `${i ? "L" : "M"}${sx(s.year).toFixed(1)},${sy(s.pct).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-svg" role="img" aria-label="Tendencia de pobreza por año">
      <line x1={pl} y1={pt} x2={pl} y2={H - pb} className="an-axis" />
      <line x1={pl} y1={H - pb} x2={W - pr} y2={H - pb} className="an-axis" />
      <path d={path} className="an-line" fill="none" />
      {series.map((s) => (
        <g key={s.year}>
          <circle cx={sx(s.year)} cy={sy(s.pct)} r={4} className="an-dot" />
          <text x={sx(s.year)} y={sy(s.pct) - 9} className="an-point-label" textAnchor="middle">
            {s.pct}%
          </text>
          <text x={sx(s.year)} y={H - 12} className="an-axis-label" textAnchor="middle">
            {s.year}
          </text>
        </g>
      ))}
    </svg>
  );
}
