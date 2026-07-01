// Contenido narrativo de Ecosistema Urbano, portado fielmente del sitio estático original.
// Es la "anatomía" (capas) y los "síntomas" (ejes) del sistema, más el método, el flujo,
// el kernel OIS y los principios públicos. Universal: aplica a cualquier ciudad.

export type EcoLayer = {
  key: string;
  name: string;
  color: string;
  desc: string;
  links: string[];
};

// Seis capas: se restaura "Tecnología y datos" como capa cívica (el sitio dinámico la había
// perdido al reusar el coral para "riesgo"). El riesgo es un eje transversal, no una capa.
export const ECO_LAYERS: EcoLayer[] = [
  {
    key: "social",
    name: "Social",
    color: "#6bae6e",
    desc: "Personas, familias, vecinos, comunidad y cultura. Es la capa que da sentido a todas las demás.",
    links: [
      "Una comunidad debilitada reduce el flujo y la confianza del comercio local.",
      "La convivencia entre vecinos sostiene la seguridad del espacio público.",
      "La cultura define cómo se usa, se cuida o se abandona la ciudad."
    ]
  },
  {
    key: "urbano",
    name: "Urbano",
    color: "#4c6fae",
    desc: "Calles, banquetas, vivienda, transporte, drenaje y espacio público: el cuerpo físico de la ciudad.",
    links: [
      "El diseño de las calles determina la movilidad y la seguridad de todos.",
      "La distancia entre vivienda y empleo es una de las raíces del tráfico.",
      "El estado del drenaje y del suelo decide el riesgo de inundación."
    ]
  },
  {
    key: "ambiental",
    name: "Ambiental",
    color: "#4a90c4",
    desc: "Lluvia, calor, agua, árboles, suelo y riesgo climático: las condiciones que hacen una zona habitable.",
    links: [
      "El suelo impermeable convierte una lluvia normal en inundación.",
      "La falta de sombra eleva el calor, el consumo y la vulnerabilidad.",
      "El agua y la vegetación definen la resiliencia de un territorio."
    ]
  },
  {
    key: "economico",
    name: "Económico",
    color: "#e0a23a",
    desc: "Trabajo, comercios, ingreso, inversión y actividad productiva: lo que sostiene a los hogares.",
    links: [
      "El ingreso del hogar sostiene el consumo, la vivienda y la educación.",
      "Los comercios dependen del flujo peatonal y de la confianza de la zona.",
      "La inversión busca territorios estables, legibles y bien mantenidos."
    ]
  },
  {
    key: "institucional",
    name: "Institucional",
    color: "#8a7cc8",
    desc: "Gobierno, normas, mantenimiento, reportes y seguimiento: lo que mantiene el sistema en orden.",
    links: [
      "El mantenimiento decide si un problema se resuelve o se acumula.",
      "El seguimiento a los reportes construye —o destruye— la confianza.",
      "Las normas ordenan cómo crece y se transforma la ciudad."
    ]
  },
  {
    key: "tecnologia",
    name: "Tecnología y datos",
    color: "#ee6a5b",
    desc: "Información, conectividad, medición y aprendizaje urbano: la capa que permite ver el resto.",
    links: [
      "Sin medición, las decisiones de la ciudad se toman a ciegas.",
      "Los datos revelan las conexiones invisibles entre las demás capas.",
      "La evidencia no impone una opinión: mejora la conversación pública."
    ]
  }
];

export type BodyPart = { label: string; color: string; eq: string; desc: string };

export const BODY_PARADIGM: BodyPart[] = [
  { label: "La movilidad", color: "#4c6fae", eq: "son sus arterias", desc: "Si el flujo se interrumpe, todo lo que depende de él se resiente." },
  { label: "La información", color: "#ee6a5b", eq: "es su sistema nervioso", desc: "Una ciudad que no puede leer sus señales toma decisiones a ciegas." },
  { label: "Los servicios básicos", color: "#4a90c4", eq: "son su infraestructura vital", desc: "Agua, luz, drenaje y transporte: sin ellos, nada más funciona bien." },
  { label: "La confianza", color: "#8a7cc8", eq: "es su tejido social", desc: "Sin confianza, comprar, invertir, denunciar y convivir se vuelven más difíciles." },
  { label: "La economía", color: "#e0a23a", eq: "es su energía circulante", desc: "El ingreso, el comercio y el empleo mantienen viva la actividad cotidiana." },
  { label: "La seguridad", color: "#6bae6e", eq: "es su capacidad de habitar", desc: "Una ciudad insegura encoge: menos salidas, menos comercio, menos ciudad." }
];

export type LadderRung = { n: number; name: string; badge: string; simple: string; method: string; color: string };

export const METHOD_LADDER: LadderRung[] = [
  {
    n: 1,
    name: "Observar",
    badge: "Nivel básico",
    color: "#6bae6e",
    simple: "Te das cuenta de algo en tu calle —una fuga, un bache, un foco fundido— y lo dices.",
    method: "Registro situado del hecho urbano. La experiencia cotidiana se trata como un dato primario, con lugar y momento."
  },
  {
    n: 2,
    name: "Nombrar",
    badge: "Nivel básico",
    color: "#4c6fae",
    simple: "Le pones nombre. ¿De qué trata? ¿Es del agua, de la calle, de la seguridad?",
    method: "Clasificación en capas (anatomía) y ejes (síntomas). Una taxonomía común que permite comparar entre zonas y asentamientos."
  },
  {
    n: 3,
    name: "Conectar",
    badge: "Nivel intermedio",
    color: "#e0a23a",
    simple: "Ves que no está solo. Esa fuga se junta con otras cosas y afecta a más gente.",
    method: "Análisis sistémico de interdependencias —cómo una capa presiona a las demás— a partir de señales repetidas y patrones por territorio."
  },
  {
    n: 4,
    name: "Comprender",
    badge: "Nivel avanzado",
    color: "#8a7cc8",
    simple: "Entiendes por qué pasa y qué se puede hacer para que mejore.",
    method: "Inferencia de causas estructurales y formulación de hipótesis accionables, documentadas y citables en el Observatorio."
  }
];

export type Symptom = { see: string; cause: string; result: string; color: string };

export const SYMPTOMS: Symptom[] = [
  { see: "Una calle inundada", cause: "Drenaje sin mantenimiento, suelo impermeable y zonas de riesgo ocupadas durante años.", result: "Una ciudad más vulnerable.", color: "#4a90c4" },
  { see: "Tráfico constante", cause: "Vivienda lejos del empleo, transporte insuficiente y calles diseñadas solo para el auto.", result: "Una ciudad más lenta y más cara.", color: "#4c6fae" },
  { see: "Negocios vacíos", cause: "Poco flujo peatonal, baja confianza y un entorno que dejó de atraer inversión.", result: "Una economía local más frágil.", color: "#e0a23a" },
  { see: "Banquetas rotas", cause: "Mantenimiento sin seguimiento y al peatón colocado en último lugar.", result: "Una ciudad menos caminable.", color: "#6bae6e" },
  { see: "Inseguridad", cause: "Espacios abandonados, poca presencia y desconfianza que se fue acumulando.", result: "Una ciudad que vive a la defensiva.", color: "#8a7cc8" },
  { see: "Desconfianza", cause: "Reportes sin respuesta y promesas incumplidas, repetidas muchas veces.", result: "Una ciudad más difícil de cuidar.", color: "#ee6a5b" }
];

export type Eje = { n: string; name: string; desc: string; color: string };

export const EJES: Eje[] = [
  { n: "01", name: "Ciudad interrumpida", desc: "Servicios básicos que fallan o se cortan. Luz, agua, transporte, comunicación.", color: "#4a90c4" },
  { n: "02", name: "Ciudad vulnerable", desc: "Riesgos físicos acumulados. Inundaciones, baches, infraestructura en deterioro.", color: "#4c6fae" },
  { n: "03", name: "Ciudad con miedo", desc: "Inseguridad que restringe movimiento, horarios, comercio y convivencia.", color: "#8a7cc8" },
  { n: "04", name: "Ciudad manipulada", desc: "Desinformación, rumores y narrativas que distorsionan la realidad urbana.", color: "#ee6a5b" },
  { n: "05", name: "Ciudad fragmentada", desc: "Desconexión entre zonas, grupos y oportunidades. Desigualdad hecha espacio.", color: "#e0a23a" },
  { n: "06", name: "Ciudad solidaria", desc: "Redes de apoyo, comunidad activa y acciones colectivas que sostienen el sistema.", color: "#6bae6e" },
  { n: "07", name: "Ciudad sin futuro", desc: "Jóvenes sin opciones, fuga de talento y ausencia de proyectos de largo plazo.", color: "#917a5c" },
  { n: "08", name: "Ciudad precaria", desc: "Empleo informal, renta inaccesible y economía de subsistencia como norma.", color: "#c47a55" }
];

export type FlujoStep = { n: string; label: string; desc: string; color: string };

export const FLUJO: FlujoStep[] = [
  { n: "01", label: "Señal", desc: "Una persona observa un hecho cotidiano y lo reporta: un corte de luz, una inundación, una zona insegura.", color: "#ee6a5b" },
  { n: "02", label: "Patrón", desc: "Otras personas reportan lo mismo. El sistema detecta zona, frecuencia y eje. La señal deja de ser aislada.", color: "#e0a23a" },
  { n: "03", label: "Impacto", desc: "El Observatorio conecta la señal con sus causas y consecuencias en las demás capas del ecosistema.", color: "#4a90c4" },
  { n: "04", label: "Evidencia", desc: "El análisis es público, citable y útil para medios, organizaciones, universidades e instituciones.", color: "#6bae6e" },
  { n: "05", label: "Acción", desc: "La información mejora decisiones: de ciudadanos, medios, comercios, colectivos e instituciones.", color: "#8a7cc8" }
];

export type KernelPillar = { pillar: string; feat: string; desc: string; color: string };

export const KERNEL_PILLARS: KernelPillar[] = [
  { pillar: "Datos", feat: "Radar de señales", desc: "Cada observación ciudadana se ordena, ubica y vuelve evidencia. Reduce la ceguera operativa de la ciudad.", color: "#4c6fae" },
  { pillar: "Comunicación", feat: "Red Local", desc: "La malla ciudadana mantiene viva la conversación aun sin internet, salto a salto entre vecinos.", color: "#ee6a5b" },
  { pillar: "Operaciones", feat: "De la señal a la acción", desc: "El flujo que convierte una experiencia individual en seguimiento, prioridad y acción coordinada.", color: "#6bae6e" },
  { pillar: "Inventario", feat: "Capas, zonas y señales", desc: "El mapa estructurado de la ciudad —sus capas, sus zonas, sus patrones— sobre el que todo se apoya.", color: "#e0a23a" },
  { pillar: "Gobernanza", feat: "Principios y privacidad", desc: "Reglas públicas, límites y supervisión humana. Sin gobernanza, la IA solo acelera el desorden.", color: "#8a7cc8" }
];

export const PRINCIPLES: string[] = [
  "No somos partido. Ninguna señal se usa para favorecer o atacar a ninguna organización política.",
  "No sustituimos autoridades. Aportamos evidencia; la acción institucional es responsabilidad de quien gobierna.",
  "No publicamos datos personales sensibles sin cuidado explícito y consentimiento claro.",
  "No explotamos tragedias. La urgencia no justifica convertir el dolor en combustible estético.",
  "Diferenciamos reporte, opinión, rumor, dato y evidencia. Nunca los mezclamos sin señalarlo.",
  "Mostramos patrones, no linchamientos. Una señal no es un juicio sobre personas.",
  "Buscamos utilidad pública, no indignación vacía. Si algo no es accionable, no lo amplificamos.",
  "La ciudad se lee mejor cuando participan muchos actores. Fomentamos diversidad de fuentes.",
  "Código abierto y soberanía tecnológica. La rendición de cuentas no puede depender de cajas negras privadas: este observatorio es software libre (AGPL-3.0), forkeable y auto-hospedable."
];

export const SMALL_QUOTES: string[] = [
  "“Solo me estacioné cinco minutos.”",
  "“Solo tiré esto aquí.”",
  "“Solo aceleré porque iba tarde.”",
  "“Solo no reporté porque nadie hace caso.”",
  "“Solo construimos sin mirar lo que pasa alrededor.”",
  "“Solo fue una lluvia fuerte.”"
];

export const SMALL_CONSEQUENCES: { text: string; color: string }[] = [
  { text: "Se vuelven tráfico.", color: "#4c6fae" },
  { text: "Se vuelven inundaciones.", color: "#4a90c4" },
  { text: "Se vuelven desconfianza.", color: "#8a7cc8" },
  { text: "Se vuelven abandono.", color: "#e0a23a" },
  { text: "Se vuelven calor.", color: "#6bae6e" },
  { text: "Se vuelven riesgo.", color: "#ee6a5b" }
];

export const CHAIN: string[] = [
  "La movilidad afecta al comercio.",
  "El comercio afecta al empleo.",
  "El empleo afecta a las familias.",
  "Las familias afectan la confianza.",
  "La confianza afecta la inversión.",
  "La infraestructura afecta el riesgo.",
  "El clima revela nuestras decisiones."
];
