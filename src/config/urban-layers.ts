import type { UrbanSignalLayer } from "@/data/urban-signals";

export type UrbanLayerKey = UrbanSignalLayer | "riesgo";

export type UrbanLayerConfig = {
  key: UrbanLayerKey;
  label: string;
  group: "Vida urbana" | "Economía y gobierno" | "Riesgo";
  description: string;
  source: string;
  color: string;
};

export const URBAN_LAYERS = [
  {
    key: "ambiental",
    label: "Ambiental",
    group: "Vida urbana",
    description: "Agua, calor, sombra, inundación y condiciones que afectan la habitabilidad.",
    source: "Radar ciudadano / fuentes ambientales",
    color: "#4a90c4"
  },
  {
    key: "urbano",
    label: "Infraestructura",
    group: "Vida urbana",
    description: "Calles, cruces, banquetas, movilidad y forma física de la ciudad.",
    source: "Inventario urbano",
    color: "#4c6fae"
  },
  {
    key: "social",
    label: "Vida social",
    group: "Vida urbana",
    description: "Accesibilidad, comunidad, convivencia y uso cotidiano del espacio público.",
    source: "Radar ciudadano",
    color: "#6bae6e"
  },
  {
    key: "economico",
    label: "Economía local",
    group: "Economía y gobierno",
    description: "Actividad comercial, cierres, flujo peatonal y señales de vitalidad económica.",
    source: "Observatorio urbano",
    color: "#e0a23a"
  },
  {
    key: "institucional",
    label: "Gobernanza",
    group: "Economía y gobierno",
    description: "Reportes, mantenimiento, seguimiento institucional y confianza pública.",
    source: "Radar ciudadano",
    color: "#8a7cc8"
  },
  {
    key: "riesgo",
    label: "Riesgos activos",
    group: "Riesgo",
    description: "Sismos, incendios, volcanes y eventos ambientales cercanos.",
    source: "USGS / NASA EONET",
    color: "#ee6a5b"
  }
] as const satisfies readonly UrbanLayerConfig[];

// Garantía EN COMPILACIÓN de que cada UrbanLayerKey tiene exactamente su entrada en URBAN_LAYERS:
// si se agrega una key al tipo y se olvida aquí, este alias deja de ser `never` y el assign falla.
type MissingLayerKey = Exclude<UrbanLayerKey, (typeof URBAN_LAYERS)[number]["key"]>;
const _allLayerKeysCovered: MissingLayerKey extends never ? true : false = true;
void _allLayerKeysCovered;

export const DEFAULT_ACTIVE_LAYERS: Record<UrbanLayerKey, boolean> = {
  ambiental: true,
  urbano: true,
  social: true,
  economico: true,
  institucional: true,
  riesgo: true
};
