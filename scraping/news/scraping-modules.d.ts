// Declaraciones de tipos para los módulos JS del pipeline de scraping, para que TS (tests y cualquier
// consumidor futuro) los importe con seguridad. El pipeline es .mjs (worker offline); aquí solo se
// tipa la superficie pública usada fuera de él.

declare module "@scraping/news/news-sources.mjs" {
  export type HeadMetadata = {
    title: string | null;
    subject: string | null;
    publishedAt: string | null;
  };
  export function parseHeadMetadata(html: string, brandRe?: RegExp): HeadMetadata;
  export function sliceHead(html: string): string;
  export function sourcesForSettlement(settlementId: string): Array<{ id: string; name: string }>;
  export function coveredSettlements(): string[];
  export function classifySignal(slug: string): { type: string; layer: string; severity: string } | null;
  export function detectColonia(slug: string, citySlug: string): { name: string; cp: string } | null;
  export function detectMunicipio(slug: string, citySlug: string): boolean;
  export function hasCityAnchor(slug: string, settlementId: string): boolean;
  export function lastSegmentParser(host: string): (loc: string) => { section: null; id: string; slug: string } | null;
  export function slugToTitle(slug: string): string;
  export function cpForColonia(settlementId: string, coloniaName: string | null): string | null;
  export function principalCp(settlementId: string): string | null;
  export const SOURCES: Array<{
    id: string;
    name: string;
    coverage: string[];
    parse: (loc: string) => { section: string | null; id: string; slug: string } | null;
    enrichable?: boolean;
    titleFromSitemap?: boolean;
    brandRe?: RegExp;
  }>;
}

declare module "@scraping/news/robots.mjs" {
  export type RobotsGroup = { agents: Set<string>; rules: Array<{ allow: boolean; path: string }> };
  export function parseRobots(text: string): RobotsGroup[];
  export function isPathAllowed(groups: RobotsGroup[], path: string, ua: string): boolean;
  export function createRobotsChecker(opts: {
    fetchText: (url: string) => Promise<string>;
    ua: string;
    onWarn?: (message: string) => void;
  }): { isAllowed(url: string): Promise<boolean> };
}
