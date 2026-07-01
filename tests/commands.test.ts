import { describe, it, expect } from "vitest";
import { SETTLEMENTS } from "@/config/settlements";
import { buildCommandIndex } from "@/lib/commands";

const GROUPS = new Set(["Vistas", "Asentamientos", "Colonias y códigos postales"]);

// Índice del buscador ⌘K. Contrato: existen las vistas base, cada asentamiento aporta sus 3 vistas,
// los grupos son los esperados y no hay ids duplicados (colisión rompería la selección con teclado).
describe("buildCommandIndex", () => {
  const cmds = buildCommandIndex();

  it("incluye Inicio y Fuentes", () => {
    expect(cmds.some((c) => c.href === "/")).toBe(true);
    expect(cmds.some((c) => c.href === "/fuentes")).toBe(true);
  });

  it("cada asentamiento aporta mapa, tablero y análisis", () => {
    for (const s of Object.values(SETTLEMENTS)) {
      expect(cmds.some((c) => c.id === `mapa-${s.id}`)).toBe(true);
      expect(cmds.some((c) => c.id === `tablero-${s.id}`)).toBe(true);
      expect(cmds.some((c) => c.id === `analisis-${s.id}`)).toBe(true);
    }
  });

  it("todo comando tiene id/label/href/group y grupo conocido", () => {
    for (const c of cmds) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.href.startsWith("/")).toBe(true);
      expect(GROUPS.has(c.group)).toBe(true);
    }
  });

  it("no hay ids duplicados", () => {
    const ids = cmds.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
