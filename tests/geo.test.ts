import { describe, it, expect } from "vitest";
import { distanceKm, clamp, toNumber, parseLat, parseLng, parseRadiusKm } from "@/lib/geo";

// Geo: la haversine alimenta el filtro por radio del mapa, y los parsers protegen las consultas a
// terceros de parámetros absurdos (lat=9999, radio negativo). Antes toNumber solo validaba "es finito".
describe("distanceKm", () => {
  it("es 0 para el mismo punto", () => {
    expect(distanceKm({ lat: 19.1, lng: -96.1 }, { lat: 19.1, lng: -96.1 })).toBeCloseTo(0, 6);
  });

  it("un grado de latitud es ~111 km", () => {
    const d = distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("es simétrica", () => {
    const a = { lat: 19.1, lng: -96.1 };
    const b = { lat: 19.2, lng: -96.2 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });
});

describe("clamp", () => {
  it("acota a los extremos", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("toNumber", () => {
  it("usa el fallback ante nulo o no-numérico", () => {
    expect(toNumber(null, 7)).toBe(7);
    expect(toNumber("abc", 7)).toBe(7);
    expect(toNumber("3.5", 0)).toBe(3.5);
  });
});

describe("parsers con rango", () => {
  it("parseLat/parseLng acotan a rangos geográficos", () => {
    expect(parseLat("9999", 19)).toBe(90);
    expect(parseLat(null, 19)).toBe(19);
    expect(parseLng("-9999", -96)).toBe(-180);
  });

  it("parseRadiusKm rechaza negativos, respeta max y piso", () => {
    expect(parseRadiusKm(null, 5)).toBe(5);
    expect(parseRadiusKm("10", 5)).toBe(10);
    expect(parseRadiusKm("-3", 5)).toBe(5); // negativo → fallback
    expect(parseRadiusKm("99999", 5)).toBe(500); // acotado al max por defecto
    expect(parseRadiusKm("0.05", 5)).toBeCloseTo(0.1, 10); // acotado al piso
  });
});
