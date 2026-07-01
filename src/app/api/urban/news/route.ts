import { NextResponse } from "next/server";
import { NEWS_META, scopeNews, countBy } from "@/lib/news";

// Señales periodísticas materializadas por el scraper offline (scraping/news/scrape-news.mjs).
// La API SOLO LEE el JSON generado — nada de scraping en request-time. Son señales "reported"
// (medio), distinguibles de lo oficial; enlazan a la nota, no reproducen el cuerpo. La carga y el
// scoping en 3 niveles viven en @/lib/news (compartidos con la vista de lista /[settlement]/noticias).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settlement = searchParams.get("settlement");

  // "Ver todo": punto + municipio del asentamiento, más nivel estado de su estado. (La UI acota por
  // radio; el mapa clusteriza lo apilado en los centroides.) Sin settlement → todo el dataset.
  const scoped = scopeNews(settlement);

  return NextResponse.json(
    {
      settlement: settlement || "all",
      signals: scoped,
      total: scoped.length,
      mapped: scoped.filter((signal) => signal.geoScope === "punto").length,
      byGeoScope: countBy(scoped, (s) => s.geoScope),
      byType: countBy(scoped, (s) => s.type),
      byPostalCode: countBy(scoped, (s) => s.postalCode),
      vintage: NEWS_META.vintage,
      generatedAt: NEWS_META.generatedAt,
      source: NEWS_META.source,
      confidence: "reported",
      note: NEWS_META.note
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
