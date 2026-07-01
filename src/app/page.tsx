import { UrbanHero } from "@/components/UrbanHero";
import { EcosistemaNarrative } from "@/components/EcosistemaNarrative";
import { SETTLEMENTS } from "@/config/settlements";

// La home es la ciudad insignia (Boca del Río) con datos reales en el hero,
// seguida de la narrativa editorial. El explorador global vive en la variante "fallback".
export default function Home() {
  return (
    <>
      <UrbanHero settlementSlug="boca-del-rio" />
      <EcosistemaNarrative cityName={SETTLEMENTS["boca-del-rio"].name} settlementSlug="boca-del-rio" />
    </>
  );
}
