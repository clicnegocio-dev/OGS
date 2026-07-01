import { notFound } from "next/navigation";
import { SETTLEMENTS } from "@/config/settlements";
import { NEWS_META, scopeNews, toBoardRows } from "@/lib/news";
import { NewsBoard } from "@/components/NewsBoard";
import "./noticias.css";

type NoticiasPageProps = {
  params: Promise<{ settlement: string }>;
};

export function generateStaticParams() {
  return Object.keys(SETTLEMENTS).map((settlement) => ({ settlement }));
}

export function generateMetadata({ params }: NoticiasPageProps) {
  return params.then(({ settlement }) => {
    const config = SETTLEMENTS[settlement];
    const name = config?.name ?? "asentamiento";
    return {
      title: `Señales en medios · ${name} — Ecosistema Urbano`,
      description: `Tablero de señales periodísticas de ${name}: reportes de medios por categoría, nivel geográfico y código postal. Reportes, no hechos verificados.`
    };
  });
}

// Vista de LISTA (tipo craigslist) complementaria al mapa: hojea TODAS las señales periodísticas del
// asentamiento (incluidas las de nivel municipio/estado que el mapa apila en centroides). Server
// component: carga y filtra por asentamiento con el mismo scoping que la API, y pasa filas ligeras.
export default async function NoticiasPage({ params }: NoticiasPageProps) {
  const { settlement } = await params;
  const config = SETTLEMENTS[settlement];
  if (!config) notFound();

  const rows = toBoardRows(scopeNews(settlement));

  return (
    <NewsBoard
      settlementId={settlement}
      settlementName={config.name}
      stateName={config.stateName}
      rows={rows}
      meta={NEWS_META}
    />
  );
}
