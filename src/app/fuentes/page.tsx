import type { Metadata } from "next";
import Link from "next/link";
import {
  DATA_SOURCES,
  STATUS_META,
  STATUS_ORDER,
  CONFIDENCE_META,
  type DataSource
} from "@/config/data-sources";
import "./fuentes.css";

export const metadata: Metadata = {
  title: "Fuentes de datos — Ecosistema Urbano",
  description:
    "De dónde viene cada dato de Ecosistema Urbano: proveedor, acceso, frescura, confianza y estado (en vivo, semilla, o en integración). Transparencia por diseño."
};

// Página de transparencia de fuentes (Principios 1 y 4). Server component: contenido estático desde
// el registro tipado src/config/data-sources.ts. Distingue honesto vivo / semilla / desconectado / OIS.
export default function FuentesPage() {
  return (
    <main className="fuentes">
      <header className="fuentes-head">
        <Link className="fuentes-back" href="/">
          ← Ecosistema Urbano
        </Link>
        <h1 className="fuentes-title">Fuentes de datos</h1>
        <p className="fuentes-sub">
          Cada dato de Ecosistema Urbano declara <b>origen, fecha y confianza</b>. Aquí está de dónde
          viene todo — y qué tan fresco y confiable es. También decimos con claridad qué es{" "}
          <b>demostración</b>, qué está <b>construido pero sin cablear</b>, y qué llega cuando la
          plataforma OIS lo materialice. <em>Sin datos ≠ sin problema.</em>
        </p>
      </header>

      <section className="fuentes-legend" aria-label="Leyenda">
        <div className="legend-block">
          <h2>Estado</h2>
          <ul>
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <span className="legend-dot" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
                <b>{STATUS_META[s].label}</b> — {STATUS_META[s].description}
              </li>
            ))}
          </ul>
        </div>
        <div className="legend-block">
          <h2>Confianza</h2>
          <ul>
            {(Object.keys(CONFIDENCE_META) as (keyof typeof CONFIDENCE_META)[]).map((c) => (
              <li key={c}>
                <b>{c}</b> — {CONFIDENCE_META[c]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {STATUS_ORDER.map((status) => {
        const sources = DATA_SOURCES.filter((s) => s.status === status);
        if (sources.length === 0) return null;
        return (
          <section className="fuentes-group" key={status} aria-label={STATUS_META[status].label}>
            <h2 className="group-title">
              <span className="legend-dot" style={{ background: STATUS_META[status].color }} aria-hidden="true" />
              {STATUS_META[status].label}
              <span className="group-count">{sources.length}</span>
            </h2>
            <div className="fuentes-grid">
              {sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="fuentes-foot">
        Ecosistema Urbano es una piel cívica de lectura. Los datos que se <b>consultan</b> viven de forma
        efímera aquí; los reportes que la ciudadanía <b>escribe</b> van a la plataforma OIS. Ver el plan de
        integración en el repositorio (<code>docs/spec-integracion-eu-ois_v1.md</code>).
      </p>
    </main>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  return (
    <article className="source-card">
      <div className="source-head">
        <h3 className="source-name">
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.name}
            </a>
          ) : (
            source.name
          )}
        </h3>
        <span className="source-provider">{source.provider}</span>
      </div>
      <p className="source-gives">{source.gives}</p>
      <dl className="source-meta">
        <div>
          <dt>Capas</dt>
          <dd>{source.layers}</dd>
        </div>
        <div>
          <dt>Acceso</dt>
          <dd>{source.access}</dd>
        </div>
        <div>
          <dt>Frescura</dt>
          <dd>{source.freshness}</dd>
        </div>
        <div>
          <dt>Confianza</dt>
          <dd>{CONFIDENCE_META[source.confidence]}</dd>
        </div>
      </dl>
      {source.note ? <p className="source-note">{source.note}</p> : null}
    </article>
  );
}
