import { Suspense } from "react";
import { UrbanHero } from "@/components/UrbanHero";
import { EcosistemaNarrative } from "@/components/EcosistemaNarrative";
import { SETTLEMENTS } from "@/config/settlements";

// La home es la ciudad insignia (Boca del Río) con datos reales en el hero,
// seguida de la narrativa editorial. El explorador global vive en la variante "fallback".
export default function Home() {
  return (
    <>
      {/* Suspense: UrbanHero usa useSearchParams (?cp) — Next lo exige en una ruta estática (#A4). */}
      <Suspense fallback={null}>
        <UrbanHero settlementSlug="boca-del-rio" />
      </Suspense>
      <EcosistemaNarrative cityName={SETTLEMENTS["boca-del-rio"].name} settlementSlug="boca-del-rio" />
    </>
  );
}
