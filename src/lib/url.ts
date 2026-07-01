// Guard compartido para enlaces de terceros (p. ej. sourceUrl que nace del sitemap scrapeado):
// solo http/https, nunca javascript:/data:. Antes cada superficie lo resolvía distinto (el popup del
// mapa sí lo aplicaba; las vistas React lo omitían). Defensa consistente en un solo lugar.
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
