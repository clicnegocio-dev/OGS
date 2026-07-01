import { notFound } from "next/navigation";
import { SETTLEMENTS } from "@/config/settlements";
import { scopeNews } from "@/lib/news";
import { AnalysisView, type CpDatum } from "@/components/AnalysisView";
import "./analisis.css";

type AnalisisPageProps = {
  params: Promise<{ settlement: string }>;
};

export function generateStaticParams() {
  return Object.keys(SETTLEMENTS).map((settlement) => ({ settlement }));
}

export function generateMetadata({ params }: AnalisisPageProps) {
  return params.then(({ settlement }) => {
    const name = SETTLEMENTS[settlement]?.name ?? "asentamiento";
    return {
      title: `Análisis · ${name} — Ecosistema Urbano`,
      description: `Análisis exploratorio de ${name}: relación entre tipos de señal por código postal y tendencia socioeconómica oficial. El análisis robusto por AGEB llega con OIS.`
    };
  });
}

// Vista de ANÁLISIS (pilar diagnóstico/predictivo). Server component: arma la matriz por CP (conteos
// de señales por tipo) desde el dataset estático de noticias y la pasa al cliente. Alcance derivado
// por docs/spec-perfiles-eu-ogs_v1.md §7 (exploratorio; robusto = OIS/AGEB).
export default async function AnalisisPage({ params }: AnalisisPageProps) {
  const { settlement } = await params;
  const config = SETTLEMENTS[settlement];
  if (!config) notFound();

  const byCp = new Map<string, CpDatum>();
  for (const signal of scopeNews(settlement)) {
    if (!signal.postalCode) continue;
    let datum = byCp.get(signal.postalCode);
    if (!datum) {
      datum = { cp: signal.postalCode, colonia: signal.colonia ?? null, total: 0, counts: {} };
      byCp.set(signal.postalCode, datum);
    }
    datum.total += 1;
    datum.counts[signal.type] = (datum.counts[signal.type] ?? 0) + 1;
    if (!datum.colonia && signal.colonia) datum.colonia = signal.colonia;
  }

  return (
    <AnalysisView
      settlementId={settlement}
      settlementName={config.name}
      stateName={config.stateName}
      cpData={[...byCp.values()]}
    />
  );
}
