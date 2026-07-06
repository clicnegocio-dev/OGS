import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// El pipeline de scraping es JS (.mjs) pero sus funciones puras son testeables desde aquí.
import {
  parseHeadMetadata,
  sliceHead,
  sourcesForSettlement,
  coveredSettlements,
  detectMunicipio,
  detectColonia,
  hasCityAnchor,
  lastSegmentParser,
  SOURCES
} from "@scraping/news/news-sources.mjs";
import { parseRobots, isPathAllowed } from "@scraping/news/robots.mjs";

// Contratos de la Capa 2 (título+asunto citables del <head>) y del respeto a robots.txt en tiempo
// real. El fixture es el <head> REAL de una nota de XEU capturado una vez (offline, sin red).
const FIXTURE = readFileSync(fileURLToPath(new URL("./fixtures/xeu-article-head.html", import.meta.url)), "utf8");

describe("parseHeadMetadata", () => {
  it("extrae título real (con acentos), asunto y fecha del <head>", () => {
    const meta = parseHeadMetadata(FIXTURE);
    expect(meta.title).toBe(
      "Acataremos si Poder Judicial resuelve que no se le deben de cobrar impuestos a Salinas: AMLO"
    );
    expect(meta.subject).toMatch(/Andrés Manuel López Obrador/); // asunto real del medio, con acentos
    expect(meta.publishedAt).toBe("2024-03-15"); // article:published_time recortado a YYYY-MM-DD
  });

  it("limpia el sufijo de marca del título y el boilerplate del asunto", () => {
    const meta = parseHeadMetadata(FIXTURE);
    expect(meta.title).not.toMatch(/xeu/i); // sin "- xeu noticias veracruz"
    expect(meta.subject).not.toMatch(/^Noticia\s/i); // sin "Noticia estado-de-veracruz :"
    expect(meta.subject).not.toMatch(/\.\.\.\s*\.\.\.$/); // sin cola de doble elipsis
  });

  it("devuelve nulls sin inventar cuando el <head> no declara metadatos", () => {
    const meta = parseHeadMetadata("<html><head></head><body>hola</body></html>");
    expect(meta.title).toBeNull();
    expect(meta.subject).toBeNull();
    expect(meta.publishedAt).toBeNull();
  });

  it("sliceHead corta en </head> (no incluye el cuerpo)", () => {
    const sliced = sliceHead("<head><title>x</title></head><body>SECRETO</body>");
    expect(sliced).not.toMatch(/SECRETO/);
  });
});

describe("robots.txt (respeto en tiempo real)", () => {
  // robots.txt actual de XEU: veda solo carpetas de assets; permite rutas de contenido a bots genéricos.
  const XEU = `User-agent: *
Disallow: /css/
Disallow: /images/
Disallow: /audios/

User-agent: PetalBot
Disallow: /`;

  it("permite rutas de contenido y veda assets para el UA genérico", () => {
    const g = parseRobots(XEU);
    const UA = "EcosistemaUrbano/0.1";
    expect(isPathAllowed(g, "/veracruz/123/una-nota", UA)).toBe(true);
    expect(isPathAllowed(g, "/css/x.css", UA)).toBe(false);
    expect(isPathAllowed(g, "/images/a.png", UA)).toBe(false);
  });

  it("un medio con Disallow: / bloquea todo (degradación a solo-slug)", () => {
    const g = parseRobots("User-agent: *\nDisallow: /");
    expect(isPathAllowed(g, "/cualquier/ruta", "EcosistemaUrbano/0.1")).toBe(false);
  });

  it("aplica el grupo específico cuando el UA declara su token", () => {
    const g = parseRobots(XEU);
    expect(isPathAllowed(g, "/veracruz/1", "PetalBot/2.0")).toBe(false); // su grupo veda todo
  });

  it("gana la regla de prefijo más largo (Allow anula Disallow más corto)", () => {
    const g = parseRobots("User-agent: *\nDisallow: /priv\nAllow: /priv/publico");
    const UA = "bot";
    expect(isPathAllowed(g, "/priv/secreto", UA)).toBe(false);
    expect(isPathAllowed(g, "/priv/publico/x", UA)).toBe(true);
  });
});

describe("config por-asentamiento", () => {
  it("cada asentamiento cubierto tiene al menos un medio", () => {
    const covered = coveredSettlements();
    expect(covered.length).toBeGreaterThan(0);
    for (const id of covered) {
      expect(sourcesForSettlement(id).length).toBeGreaterThan(0);
    }
  });

  it("un asentamiento sin cobertura devuelve lista vacía", () => {
    expect(sourcesForSettlement("no-existe-xyz")).toEqual([]);
  });
});

describe("multi-fuente", () => {
  it("cada medio declara parse + coverage no vacía", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(2);
    for (const s of SOURCES) {
      expect(typeof s.parse).toBe("function");
      expect(Array.isArray(s.coverage) && s.coverage.length > 0).toBe(true);
    }
  });

  it("lastSegmentParser extrae el slug del último segmento (URL plana o con fecha)", () => {
    const parse = lastSegmentParser("plumaslibres.com.mx");
    const p = parse("https://plumaslibres.com.mx/2026/07/01/socavon-en-rio-medio-en-el-puerto/");
    expect(p?.slug).toBe("socavon-en-rio-medio-en-el-puerto");
    expect(p?.section).toBeNull();
    expect(parse("https://otrodominio.com/2026/07/01/x-y-z/")).toBeNull(); // host distinto
    expect(parse("https://plumaslibres.com.mx/deportes/")).toBeNull(); // categoría corta, no artículo
  });

  it("detectMunicipio: 'boca-del-rio' sí, 'veracruz' suelto no (ambiguo)", () => {
    expect(detectMunicipio("obras-en-boca-del-rio-avanzan", "boca-del-rio")).toBe(true);
    expect(detectMunicipio("gobierno-de-veracruz-anuncia-plan", "veracruz")).toBe(false);
    expect(detectMunicipio("socavon-en-el-puerto-de-veracruz", "veracruz")).toBe(true);
  });

  it("detectColonia exige la ciudad para 'Centro' (no confunde el centro de otro municipio)", () => {
    expect(detectColonia("asesinado-en-el-centro-de-cuitlahuac", "veracruz")).toBeNull();
    expect(detectColonia("pirotecnia-en-el-centro-historico-de-xalapa", "veracruz")).toBeNull();
    expect(detectColonia("robo-en-la-zona-centro-de-veracruz", "veracruz")?.name).toBe("Centro");
  });

  it("hasCityAnchor: ancla colonias genéricas al municipio correcto", () => {
    // "zaragoza" (genérica) sin ancla → sin ciudad; con "veracruz" en el slug → anclada.
    expect(hasCityAnchor("atropellan-en-el-centro-de-xalapa-cerca-de-zaragoza", "veracruz")).toBe(false);
    expect(hasCityAnchor("vecinos-de-zaragoza-en-veracruz-alertan-por-saqueo", "veracruz")).toBe(true);
    expect(hasCityAnchor("obra-en-el-fraccionamiento-reforma-de-boca-del-rio", "boca-del-rio")).toBe(true);
  });
});
