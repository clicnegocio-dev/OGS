"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { URBAN_LAYERS } from "@/config/urban-layers";
import { CpDossier } from "@/components/CpDossier";
import type { BoardRow, GeoScope, NewsMeta } from "@/lib/news";

// Tablero tipo "craigslist": lista densa de señales periodísticas, filtrable por categoría, nivel
// geográfico y código postal, con búsqueda. Complementa el mapa: aquí se HOJEA todo (incluido lo de
// nivel municipio/estado que en el mapa se apila en un centroide). Honesto: cada nota es un REPORTE
// de medio (no hecho verificado) y enlaza a su fuente.

const LAYER_COLOR: Record<string, string> = Object.fromEntries(URBAN_LAYERS.map((l) => [l.key, l.color]));

const SCOPE_LABEL: Record<GeoScope, string> = {
  punto: "Colonia (punto)",
  municipio: "Nivel municipio",
  estado: "Nivel estado"
};

function tally(rows: BoardRow[], get: (r: BoardRow) => string | null | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = get(r);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()];
}

export function NewsBoard({
  settlementId,
  settlementName,
  stateName,
  rows,
  meta
}: {
  settlementId: string;
  settlementName: string;
  stateName: string;
  rows: BoardRow[];
  meta: NewsMeta;
}) {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [scope, setScope] = useState<GeoScope | null>(null);
  const [cp, setCp] = useState<string | null>(null);

  // Conversación con el mapa: lee ?cp / ?tipo / ?nivel de la URL para pre-aplicar filtros (deep-link).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cpParam = params.get("cp");
    const tipoParam = params.get("tipo");
    const nivelParam = params.get("nivel");
    if (cpParam) setCp(cpParam);
    if (tipoParam) setTipo(tipoParam);
    if (nivelParam === "punto" || nivelParam === "municipio" || nivelParam === "estado") setScope(nivelParam);
  }, []);

  // Opciones de filtro con conteos (sobre el set completo del asentamiento).
  const tipos = useMemo(() => tally(rows, (r) => r.type).sort((a, b) => b[1] - a[1]), [rows]);
  const scopes = useMemo(() => tally(rows, (r) => r.geoScope), [rows]);
  const cps = useMemo(() => tally(rows, (r) => r.postalCode).sort((a, b) => b[1] - a[1]), [rows]);
  const typeColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of rows) if (!m[r.type]) m[r.type] = LAYER_COLOR[r.layer] || "#8a8f98";
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (tipo ? r.type === tipo : true))
      .filter((r) => (scope ? r.geoScope === scope : true))
      .filter((r) => (cp ? r.postalCode === cp : true))
      .filter((r) => (q ? `${r.title} ${r.colonia ?? ""}`.toLowerCase().includes(q) : true))
      .slice()
      .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""));
  }, [rows, query, tipo, scope, cp]);

  const hasFilter = Boolean(query || tipo || scope || cp);

  // Dossier del CP seleccionado: síntesis de sus señales (colonia, desglose, últimas) + salto al mapa.
  const cpDossier = useMemo(() => {
    if (!cp) return null;
    const cpRows = rows.filter((r) => r.postalCode === cp);
    if (cpRows.length === 0) return null;
    const colonia = cpRows.find((r) => r.colonia)?.colonia ?? null;
    const counts = new Map<string, { layer: string; count: number }>();
    for (const r of cpRows) {
      const entry = counts.get(r.type) ?? { layer: r.layer, count: 0 };
      entry.count += 1;
      counts.set(r.type, entry);
    }
    const byType = [...counts.entries()]
      .map(([type, v]) => ({ type, layer: v.layer, count: v.count }))
      .sort((a, b) => b.count - a.count);
    const recent = [...cpRows]
      .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""))
      .slice(0, 4)
      .map((r) => ({ id: r.id, title: r.title, observedAt: r.observedAt, sourceUrl: r.sourceUrl }));
    return { cp, colonia, total: cpRows.length, byType, recent };
  }, [rows, cp]);

  return (
    <main className="board">
      <header className="board-head">
        <a className="board-back" href={`/${settlementId}`}>
          ← Volver al mapa
        </a>
        <a className="board-back" href={`/${settlementId}/analisis`} style={{ marginLeft: 16 }}>
          Análisis →
        </a>
        <Link className="board-back" href="/fuentes" style={{ marginLeft: 16 }}>
          Fuentes de datos →
        </Link>
        <h1 className="board-title">Tablero de señales · {settlementName}</h1>
        <p className="board-sub">
          {rows.length} señales periodísticas de {settlementName}, {stateName}. Cada nota enlaza a su
          fuente: son <b>reportes de medios</b>, no hechos verificados.
        </p>
        <p className="board-meta">
          Fuente: {meta.source} · corte {meta.vintage} · código postal aproximado (semilla)
        </p>
      </header>

      <div className="board-layout">
        <aside className="board-filters" aria-label="Filtros">
          <div className="filter-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en titulares…"
              aria-label="Buscar en titulares"
            />
          </div>

          <FilterGroup title="Categoría">
            <FilterOption label="Todas" count={rows.length} active={!tipo} onClick={() => setTipo(null)} />
            {tipos.map(([t, n]) => (
              <FilterOption
                key={t}
                label={t}
                count={n}
                active={tipo === t}
                color={typeColor[t]}
                onClick={() => setTipo(tipo === t ? null : t)}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Nivel geográfico">
            <FilterOption label="Todos" count={rows.length} active={!scope} onClick={() => setScope(null)} />
            {scopes.map(([sc, n]) => (
              <FilterOption
                key={sc}
                label={SCOPE_LABEL[sc as GeoScope] ?? sc}
                count={n}
                active={scope === sc}
                onClick={() => setScope(scope === sc ? null : (sc as GeoScope))}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Código postal">
            <FilterOption label="Todos" count={rows.length} active={!cp} onClick={() => setCp(null)} />
            {cps.map(([c, n]) => (
              <FilterOption key={c} label={c} count={n} active={cp === c} onClick={() => setCp(cp === c ? null : c)} />
            ))}
            {cp ? (
              <a className="filter-map-link" href={`/${settlementId}?cp=${encodeURIComponent(cp)}`}>
                Ver CP {cp} en el mapa →
              </a>
            ) : null}
          </FilterGroup>

          {hasFilter ? (
            <button
              type="button"
              className="filter-clear"
              onClick={() => {
                setQuery("");
                setTipo(null);
                setScope(null);
                setCp(null);
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </aside>

        <section className="board-main" aria-label="Listado de señales">
          {cpDossier ? (
            <div style={{ marginBottom: 18 }}>
              <CpDossier
                cp={cpDossier.cp}
                colonia={cpDossier.colonia}
                municipioName={settlementName}
                total={cpDossier.total}
                byType={cpDossier.byType}
                recent={cpDossier.recent}
                mapHref={`/${settlementId}?cp=${cpDossier.cp}`}
                onClear={() => setCp(null)}
              />
            </div>
          ) : null}
          <p className="board-count" role="status" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "señal" : "señales"}
          </p>
          {filtered.length === 0 ? (
            <p className="board-empty">No hay señales con estos filtros.</p>
          ) : (
            <ul className="board-list">
              {filtered.map((r) => (
                <li key={r.id} className="board-row">
                  <span className="row-date">{(r.observedAt || "").slice(0, 10) || "s/f"}</span>
                  <span className="row-tag" style={{ ["--tag" as string]: typeColor[r.type] || "#8a8f98" }}>
                    {r.type}
                  </span>
                  {r.sourceUrl ? (
                    <a className="row-title" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {r.title}
                    </a>
                  ) : (
                    <span className="row-title">{r.title}</span>
                  )}
                  <span className="row-place">{placeOf(r)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function placeOf(r: BoardRow): string {
  const base =
    r.geoScope === "municipio" ? "Nivel municipio" : r.geoScope === "estado" ? "Nivel estado" : r.colonia || "—";
  return r.postalCode ? `${base} · CP ${r.postalCode}` : base;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-group">
      <h2 className="filter-title">{title}</h2>
      <div className="filter-options">{children}</div>
    </div>
  );
}

function FilterOption({
  label,
  count,
  active,
  color,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`filter-option ${active ? "is-active" : ""}`} aria-pressed={active} onClick={onClick}>
      {color ? <span className="opt-dot" style={{ background: color }} aria-hidden="true" /> : null}
      <span className="opt-label">{label}</span>
      <span className="opt-count">{count}</span>
    </button>
  );
}
