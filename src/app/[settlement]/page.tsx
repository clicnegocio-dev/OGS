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
      <UrbanHero settlementSlug={settlement} />
      <EcosistemaNarrative cityName={config.name} settlementSlug={settlement} />
    </>
  );
}
