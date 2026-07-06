import { SETTLEMENTS } from "@/config/settlements";
import { postalCommandIndex } from "@/lib/news";

// Índice de comandos para el buscador ⌘K: vistas, asentamientos y colonias/códigos postales. Se
// construye en el server (layout) y se pasa compacto al cliente (no serializa el dataset de noticias).

export type CommandLink = {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: string;
};

export function buildCommandIndex(): CommandLink[] {
  const cmds: CommandLink[] = [
    { id: "home", label: "Inicio", href: "/", group: "Vistas" },
    { id: "fuentes", label: "Fuentes de datos", href: "/fuentes", group: "Vistas" }
  ];

  for (const s of Object.values(SETTLEMENTS)) {
    cmds.push({
      id: `mapa-${s.id}`,
      label: `Mapa · ${s.name}`,
      sub: s.stateName,
      href: `/${s.id}`,
      group: "Asentamientos"
    });
    cmds.push({
      id: `tablero-${s.id}`,
      label: `Tablero de señales · ${s.name}`,
      sub: s.stateName,
      href: `/${s.id}/noticias`,
      group: "Asentamientos"
    });
    cmds.push({
      id: `analisis-${s.id}`,
      label: `Análisis · ${s.name}`,
      sub: s.stateName,
      href: `/${s.id}/analisis`,
      group: "Asentamientos"
    });
  }

  for (const p of postalCommandIndex()) {
    const name = SETTLEMENTS[p.settlementId]?.name ?? p.settlementId;
    cmds.push({
      id: `cp-${p.settlementId}-${p.cp}`,
      label: p.colonia ? `${p.colonia} · CP ${p.cp}` : `CP ${p.cp} · ${name}`,
      sub: name,
      href: `/${p.settlementId}?cp=${p.cp}`,
      group: "Colonias y códigos postales"
    });
  }

  return cmds;
}
