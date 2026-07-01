import { describe, it, expect } from "vitest";
import { SETTLEMENTS } from "@/config/settlements";
import {
  ALL_NEWS,
  scopeNews,
  countBy,
  toBoardRows,
  buildCpDossier,
  postalCommandIndex,
  type CpDossierItem
} from "@/lib/news";

const GEO_SCOPES = new Set(["punto", "municipio", "estado"]);

// Contratos del plano de LECTURA sobre el snapshot real (500 señales). No probamos el número exacto
// (cambia al re-scrapear) sino los INVARIANTES: scoping en 3 niveles, conteos y forma del dossier.
describe("ALL_NEWS (snapshot)", () => {
  it("no está vacío y toda señal tiene un geoScope válido", () => {
    expect(ALL_NEWS.length).toBeGreaterThan(0);
    for (const s of ALL_NEWS) {
      expect(GEO_SCOPES.has(s.geoScope)).toBe(true);
      expect(Number.isFinite(s.lat)).toBe(true);
      expect(Number.isFinite(s.lng)).toBe(true);
    }
  });
});

describe("scopeNews", () => {
  it("sin asentamiento devuelve todo el dataset", () => {
    expect(scopeNews(null)).toBe(ALL_NEWS);
  });

  it("cada señal del alcance es del asentamiento o nivel-estado de su estado", () => {
    for (const id of Object.keys(SETTLEMENTS)) {
      const scoped = scopeNews(id);
      const stateCode = SETTLEMENTS[id]?.inegi?.entityCode;
      for (const s of scoped) {
        const ok = s.settlementId === id || (s.geoScope === "estado" && s.stateCode === stateCode);
        expect(ok).toBe(true);
      }
    }
  });

  it("un asentamiento inexistente no cuela señales de otros estados", () => {
    // stateCode = undefined ⇒ solo colarían señales estado con stateCode undefined (no debería haber).
    for (const s of scopeNews("no-existe-xyz")) {
      expect(s.settlementId).toBe("no-existe-xyz");
    }
  });
});

describe("countBy", () => {
  it("los conteos por geoScope suman el total", () => {
    const counts = countBy(ALL_NEWS, (s) => s.geoScope);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(ALL_NEWS.length);
    for (const key of Object.keys(counts)) expect(GEO_SCOPES.has(key)).toBe(true);
  });

  it("ignora claves nulas/vacías", () => {
    expect(countBy(ALL_NEWS, () => null)).toEqual({});
    expect(countBy(ALL_NEWS, () => "")).toEqual({});
  });
});

describe("toBoardRows", () => {
  it("preserva longitud y geoScope, con los campos esperados", () => {
    const rows = toBoardRows(ALL_NEWS.slice(0, 10));
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      expect(GEO_SCOPES.has(r.geoScope)).toBe(true);
      expect(typeof r.id).toBe("string");
      expect("sourceUrl" in r).toBe(true);
      expect("postalCode" in r).toBe(true);
    }
  });
});

describe("buildCpDossier", () => {
  const items: CpDossierItem[] = [
    { id: "1", type: "Inundación", layer: "riesgo", title: "A", observedAt: "2026-01-01", colonia: "Centro", postalCode: "94290" },
    { id: "2", type: "Inundación", layer: "riesgo", title: "B", observedAt: "2026-03-01", postalCode: "94290" },
    { id: "3", type: "Bache", layer: "movilidad", title: "C", observedAt: "2026-02-01", postalCode: "94290" },
    { id: "4", type: "Bache", layer: "movilidad", title: "D", observedAt: "2026-05-01", postalCode: "94290" },
    { id: "5", type: "Bache", layer: "movilidad", title: "E", observedAt: "2026-04-01", postalCode: "94290" },
    { id: "x", type: "Otro", layer: "otro", title: "Fuera de CP", observedAt: "2026-06-01", postalCode: "00000" }
  ];

  it("devuelve null sin CP o sin coincidencias", () => {
    expect(buildCpDossier(items, null)).toBeNull();
    expect(buildCpDossier(items, "11111")).toBeNull();
  });

  it("agrega solo el CP pedido, ordena por conteo y toma la colonia con nombre", () => {
    const d = buildCpDossier(items, "94290")!;
    expect(d.cp).toBe("94290");
    expect(d.total).toBe(5);
    expect(d.colonia).toBe("Centro");
    expect(d.byType[0]).toEqual({ type: "Bache", layer: "movilidad", count: 3 });
    expect(d.byType[1]).toEqual({ type: "Inundación", layer: "riesgo", count: 2 });
  });

  it("recent trae máximo 4, más recientes primero", () => {
    const d = buildCpDossier(items, "94290")!;
    expect(d.recent).toHaveLength(4);
    const dates = d.recent.map((r) => r.observedAt);
    const sorted = [...dates].sort((a, b) => (b || "").localeCompare(a || ""));
    expect(dates).toEqual(sorted);
    expect(dates[0]).toBe("2026-05-01");
  });
});

describe("postalCommandIndex", () => {
  it("no repite la llave asentamiento:CP", () => {
    const idx = postalCommandIndex();
    const keys = idx.map((e) => `${e.settlementId}:${e.cp}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of idx) {
      expect(typeof e.settlementId).toBe("string");
      expect(typeof e.cp).toBe("string");
    }
  });
});
