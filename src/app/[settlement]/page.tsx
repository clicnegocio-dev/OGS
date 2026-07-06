import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UrbanHero } from "@/components/UrbanHero";
import { EcosistemaNarrative } from "@/components/EcosistemaNarrative";
import { SETTLEMENTS } from "@/config/settlements";

type SettlementPageProps = {
  params: Promise<{ settlement: string }>;
};

export function generateStaticParams() {
  return Object.keys(SETTLEMENTS).map((settlement) => ({ settlement }));
}

export default async function SettlementPage({ params }: SettlementPageProps) {
  const { settlement } = await params;
  const config = SETTLEMENTS[settlement];
  if (!config) notFound();
  return (
    <>
      {/* Suspense: UrbanHero usa useSearchParams (?cp) — Next lo exige en una ruta estática (#A4). */}
      <Suspense fallback={null}>
        <UrbanHero settlementSlug={settlement} />
      </Suspense>
      <EcosistemaNarrative cityName={config.name} settlementSlug={settlement} />
    </>
  );
}
