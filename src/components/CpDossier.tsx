"use client";

import { URBAN_LAYERS } from "@/config/urban-layers";
import { isSafeHttpUrl } from "@/lib/url";

// Dossier por código postal (patrón "country dossier" de World Monitor, aplicado al asentamiento):
// sintetiza lo que ya tenemos sobre un CP — colonia, conteo y desglose de señales, contexto
// socioeconómico (a nivel municipio) y las últimas notas — en una unidad de lectura. Presentacional
// y agnóstico de contexto: se usa tanto en el mapa (identidad oscura) como en el tablero (clara), con
// colores neutros que heredan del contenedor. Honesto: reportes de medios, CP semilla.

const LAYER_COLOR: Record<string, string> = Object.fromEntries(URBAN_LAYERS.map((l) => [l.key, l.color]));

export type DossierTypeCount = { type: string; layer: string; count: number };
export type DossierRecent = { id: string; title: string; observedAt: string | null; sourceUrl: string | null };

export function CpDossier({
  cp,
  colonia,
  municipioName,
  total,
  byType,
  recent,
  profileLines,
  listHref,
  mapHref,
  onClear
}: {
  cp: string;
  colonia: string | null;
  municipioName: string;
  total: number;
  byType: DossierTypeCount[];
  recent: DossierRecent[];
  profileLines?: string[];
  listHref?: string;
  mapHref?: string;
  onClear?: () => void;
}) {
  return (
    <section className="dossier" aria-label={`Dossier del código postal ${cp}`}>
      <header className="dossier-head">
        <div>
          <p className="dossier-kicker">Dossier · CP {cp}</p>
          <h3 className="dossier-title">{colonia || municipioName}</h3>
          <p className="dossier-sub">
            {colonia ? `${municipioName} · ` : ""}
            {total} {total === 1 ? "señal periodística" : "señales periodísticas"}
          </p>
        </div>
        {onClear ? (
          <button type="button" className="dossier-close" onClick={onClear} aria-label="Quitar dossier">
            ×
          </button>
        ) : null}
      </header>

      {byType.length ? (
        <div className="dossier-tags">
          {byType.map((b) => (
            <span key={b.type} className="dossier-tag" style={{ ["--tag" as string]: LAYER_COLOR[b.layer] || "#8a8f98" }}>
              {b.type} <b>{b.count}</b>
            </span>
          ))}
        </div>
      ) : null}

      {profileLines && profileLines.length ? (
        <div className="dossier-context">
          <p className="dossier-context-title">Contexto (a nivel municipio)</p>
          {profileLines.map((line) => (
            <p key={line} className="dossier-context-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {recent.length ? (
        <div className="dossier-recent">
          <p className="dossier-recent-title">Últimas señales</p>
          <ul>
            {recent.map((r) => (
              <li key={r.id}>
                {r.sourceUrl && isSafeHttpUrl(r.sourceUrl) ? (
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {r.title}
                  </a>
                ) : (
                  <span>{r.title}</span>
                )}
                <span className="dossier-recent-meta">{(r.observedAt || "").slice(0, 10) || "s/f"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mapHref || listHref ? (
        <div className="dossier-actions">
          {mapHref ? (
            <a className="dossier-action" href={mapHref}>
              Ver en el mapa →
            </a>
          ) : null}
          {listHref ? (
            <a className="dossier-action" href={listHref}>
              Ver todas en lista →
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="dossier-note">CP aproximado (semilla) · reportes de medios, no hechos verificados.</p>
    </section>
  );
}
