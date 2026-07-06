# Ecosistema Urbano sobre OIS — Plan MVP + SPEC de integración (agnóstica)

Fecha: 2026-06-30
Estado: **autoritativo**. Reemplaza a `spec-arquitectura-ois.md` (que especificaba un backend
—PostGIS, worker, `urban_reports`— que **ya existe en OIS**; construirlo en EU sería duplicar).
Audiencia doble: (A) quien construye el MVP de EU; (B) OIS, para construir _después_ las
superficies genéricas que EU consumirá.

---

## 0. Reglas de este documento (la regla de oro)

1. **EU es un MVP.** Avanza hasta donde sea posible **visual y técnicamente** sin tocar OIS.
2. **No se toca OIS.** El MVP no modifica el backend de OIS ni implementa nada fuera de su paradigma.
3. **OIS es agnóstico — no crea campos específicos de EU.** Consecuencia operativa:
   > EU **nunca** pide a OIS una columna `lat`, `layer`, `severity`, `eje` ni `asentamiento`.
   > EU mapea a las **primitivas genéricas** de OIS (`Signal`/`Event`, `JusticeCase`, memoria,
   > continuidad) y mete toda su ontología cívica **dentro del sobre JSONB** (`content` / `payload`)
   > o la conserva en su propia piel. **Si algo "necesita un campo en OIS", está mal modelado: va al sobre.**
4. **Lo que requiera construcción en OIS** no se construye aquí: se especifica en la **Parte B**
   como _ask agnóstico_, en términos genéricos de OIS, para que OIS lo construya cuando toque.
5. **Secuencia por foco del dolor:** EU (ciudadano) → OIS (operación/continuidad) → OGS (gobierno/
   sistémico). OGS es lo último por _secuencia_, no por jerarquía: primero se mapea el dolor.

---

## 1. Arquitectura: tres líneas, un lazo

| Línea                 | Qué es                                                                               | En código                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **OGS**               | Sustrato **doctrinal** (el para-qué): rendición de cuentas pública del asentamiento. | No es un backend aparte: es la **vertical de gobierno** de OIS (su `JusticeCase` aplicado a la operación pública).       |
| **OIS**               | Sustrato **técnico** (el motor de continuidad): el sistema operativo organizacional. | **Existe y está maduro**: multi-tenant + RLS + site-by-host + piel por tenant + MCP; pipeline `T0→T5+TS`; `JusticeCase`. |
| **Ecosistema Urbano** | La **piel cívica**, perspectiva ciudadana, la puerta del dolor.                      | Front-end propio (este repo) + tenant `ecosistemaurbano` ya sembrado en OIS.                                             |

Las tres son **segmentos de un mismo lazo de rendición de cuentas en tres relojes**: EU en tiempo
real (la señal), OIS en tiempo de continuidad (la memoria que sobrevive a administraciones), OGS en
tiempo institucional (el expediente `filed→…→closed`). El ciudadano emite (EU), el gobierno responde
(OGS), OIS lo recuerda. Unidad territorial: **asentamiento** (urbano _y_ rural), no "ciudad".

### Realidad de OIS (verificada por lectura del repo `ois-institucional/ois`)

- **Maduro:** sustrato multi-tenant + RLS + `site-by-host` + piel por tenant (PWA) + canal **MCP**.
- **Construido (bordes del pipeline):** `T0` Event (append-only, RLS), `T1` Memoria, `T5` Operator
  ("SARA" responde/escala), `TS` Salvaguarda; **`JusticeCase` + `JusticeCaseAction`** (migración 0038)
  = el loop de rendición de cuentas (responsable/estado/resolución/cierre + bitácora inmutable).
- **NO construido (el cerebro):** `T2` detección de patrones y `T3` interpretación = _seam_ de contrato.
  **El "señal→patrón por zona/eje" —tesis de EU— no existe en ningún repo todavía.**
- **Especificado, sin construir:** API genérica por tenant `/api/v1/tenant/*` (SPEC-API_v1) y el
  `Signal` canónico (`organizational_memory.signals_persisted`, SPEC-DATA_v1.1).
- **Ya hecho:** EU está **sembrado como tenant** `ecosistemaurbano` (`vertical: media`) en OIS.

---

## 2. La frontera EU ↔ OIS (qué es de quién)

| De **EU** (su piel / su repo / su modelo vertical)                                                                                                            | De **OIS** (genérico, agnóstico; EU consume, no duplica)                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Mapa MapLibre + capas públicas de lectura: DENUE, clima/aire (Open-Meteo), riesgo (USGS/EONET), perfil socioeconómico (DataMéxico), prensa.                   | Tenant + RLS + `site-by-host` + piel por tenant.                                   |
| Narrativa/pedagogía: 6 capas, 8 ejes, escalera de método, "en simple/en método".                                                                              | `T0` captura (`Signal`/`Event`, **`content` JSONB**) + `T1` memoria + continuidad. |
| **Modelo vertical** (vive en EU, **nunca** como columnas de OIS): `lat/lng`, `layer`, `eje`, `severity`, `confidence`-tier, `asentamiento`, taxonomía urbana. | `JusticeCase` + `JusticeCaseAction` (responsable/estado/cierre).                   |
| Honestidad de cobertura (fuente/fecha/confianza, `seed:true`, "sin datos aún").                                                                               | `T2` patrones (cuando exista) · MCP · Operator.                                    |

**Lo que EU DEJA de construir (era duplicar OIS):** el plan PostGIS / worker / `urban_reports` de
`spec-arquitectura-ois.md`, el backend de reportes, la persistencia propia, el pipeline propio. Todo
eso es de OIS.

---

## 3. Contrato de datos: el sobre genérico

EU conserva su tipo `UrbanMapSignal` (`src/types/urban.ts`) **en su piel**. Cuando un dato cruza a
OIS, se mapea a una primitiva genérica y la estructura cívica viaja **dentro del sobre JSONB**:

```jsonc
// Señal cívica → primitiva genérica Signal/Event de OIS (NO se añaden columnas a OIS)
{
  "signal_type": "civic.urban.signal", // string genérico; OIS no lo interpreta
  "occurred_at": "2026-06-30T...",
  "actor_origin": "human", // genérico (human|system)
  "content": {
    // SOBRE JSONB — aquí vive TODA la ontología de EU
    "title": "...",
    "description": "...",
    "layer": "ambiental",
    "eje": "02",
    "type": "inundacion",
    "severity": "high",
    "confidence": "reported",
    "geo": { "lat": 19.1, "lng": -96.1 },
    "settlement": "boca-del-rio",
    "source": { "name": "...", "url": "..." }
  }
}
```

- **Mapea directo a `Signal`/`Event`:** `id`, `occurred_at`/`observedAt`, `signal_type`/`type`, `actor_origin`/`source`.
- **Va en el sobre `content`:** `layer, eje, severity, confidence, geo{lat,lng}, settlement, title, description`.
  → OIS los almacena como JSONB opaco; **no crea columnas**, no las interpreta.
- **Cuando una señal exige respuesta del gobierno** → abre un **`JusticeCase` genérico**:
  `challenged_act_type` = ref del acto público (p.ej. obra/licencia de CKAN), `complaint` = descripción,
  `complainant_id` = emisor; el ciclo `status` + `reviewer_id` (responsable) + `resolution`/`remedy`/
  `closed_at` + el ledger `JusticeCaseAction` son **de OIS, genéricos**. La especificidad cívica viaja
  en refs/`content`, no en columnas nuevas.
- **EU mantiene geo y agregación en su propia piel** (front-end + su lectura propia), porque OIS no
  modela geografía. La proyección "señal en el mapa" es trabajo de EU; la memoria/continuidad/patrón es de OIS.

> Mapeo confirmado: `UrbanMapSignal` no es **un** tipo de OIS, sino **{observación inmutable
> `Signal`/`Event`} + {expediente mutable `JusticeCase`}** + las extensiones que viven en el sobre.

---

## 4. Parte A — EU MVP (lo que EU construye AHORA, sin tocar OIS)

Alcance: **maximizar lo visual y técnico con lo que OIS ya expone hoy + el front-end propio.**

- **A1 · Piel cívica (ya existe, mantener y pulir).** Mapa + capas públicas de lectura. Es el valor de
  EU y **no depende de OIS**. Conservar la honestidad de cobertura (`source`/`vintage`/`confidence`/`seed`).
- **A2 · Captura ciudadana real contra la puerta YA EXISTENTE de OIS.** Reemplazar el hack actual
  (`wa.me` al número del Asistente ClicNegocio en `EcosistemaNarrative.tsx`) por captura in-app que haga
  `POST /public/site/ecosistemaurbano/contact` con el reporte serializado en el sobre (§3) dentro de
  `message`. Aterriza como `PresenceInteraction` real en OIS y el Operator acusa/escala. **Cero cambios
  en OIS** (es una superficie pública ya construida, anónima, rate-limited).
- **A3 · EU posee su modelo vertical.** `geo/layer/eje/severity/confidence` viven en el front-end y en
  el sobre; las semillas siguen marcadas `seed:true`. Nada de esto se empuja a columnas de OIS.
- **A4 · Honestidad: sin patrones agregados todavía.** Mientras `T2` no exista en OIS (Parte B), EU
  muestra **señales individuales**, no patrones por zona. Texto explícito: "sin datos agregados aún".
  No presentar feeds-demo como datos reales.
- **A5 · EU como tenant + front-end propio.** Servirse resolviendo por host/slug a `/public/*` del
  tenant `ecosistemaurbano` (ya sembrado). _Pendiente operativo:_ verificar el dominio del tenant
  (hoy `verified:false`) — es config de OIS/Owner, no código de EU.
- **A6 · Apagar la duplicación.** Retirar de la doctrina de EU el plan de backend propio
  (`spec-arquitectura-ois.md`); este documento lo reemplaza.

**Límite del MVP:** EU llega hasta "señales cívicas individuales, capturadas en OIS, sobre un mapa
honesto". Todo lo _analítico_ (patrón, índice, expediente) **espera a la Parte B**, porque es de OIS.

---

## 5. Parte B — Asks agnósticos a OIS (para construir DESPUÉS, en términos de OIS)

Ninguno pide campos específicos de EU; todos son **superficies genéricas** que OIS ya especificó o
construyó. EU solo consume.

- **B1 · Exponer la API genérica por tenant `/api/v1/tenant/*`** (ya en `SPEC-API_v1`): `POST
/tenant/signals` con `content` JSONB libre, `GET /tenant/threads`, auth por **API-key /
  `client_credentials`** (server-to-server). EU migra de la puerta pública (A2) a esto. _Genérico: el
  `content` JSONB absorbe la ontología cívica._
- **B2 · Materializar el `Signal` canónico T0** (`organizational_memory.signals_persisted`, ya en
  `SPEC-DATA_v1.1`, sin tabla aún). _Genérico, append-only, `content` JSONB._
- **B3 · `T2` detección de patrones como capacidad GENÉRICA.** Agrupar señales por las llaves que vengan
  **en el `content`** (sin hardcodear "zona/eje" de EU; EU pasa sus claves de agrupación en el sobre).
  Es el cerebro que **EU y OGS** comparten. Hoy es un _stub_ — es el trabajo de mayor valor.
- **B4 · Exponer `JusticeCase` por tenant vía API** (para la fase OGS): abrir/leer expedientes
  genéricos. Ya construido (migración 0038); falta —si no existe— la superficie API por tenant.
- **B5 · (futuro) seam multi-número→tenant** para que un WhatsApp inbound se atribuya al tenant EU
  (hoy mapea a un único `WHATSAPP_TENANT_SLUG` global). Canal secundario hasta entonces.

---

## 6. Roadmap progresivo (pain-first, gated)

| Fase                            | Quién                                  | Qué                                                                                                                              | Gate                                                     |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0 · Arquitectura**            | EU                                     | Decidir: EU = tenant `ecosistemaurbano` + front-end propio; apagar backend propio.                                               | —                                                        |
| **1 · Piel del dolor**          | EU (sin tocar OIS)                     | A1–A6: piel cívica + captura por la puerta pública existente + honestidad de cobertura.                                          | OIS expone hoy `/public/*`.                              |
| **2 · Cerebro cívico**          | **OIS primero**, luego EU consume      | B1–B3: API genérica + `Signal` + `T2`. EU pasa de la puerta pública a `/api/v1/tenant/signals` y empieza a leer patrones.        | Owner de OIS prioriza B1–B3.                             |
| **3 · OGS (vertical gobierno)** | OIS expone B4; EU/OGS enciende el lazo | Expedientes `JusticeCase` sobre actos públicos; cablear CKAN/Obra Pública como `challenged_act`; **señales → política pública**. | "Los dolores ya son claros" (señales+patrones fluyendo). |

---

## 7. Dependencias honestas / degradación

- **`T2` inexistente** = el "señal→patrón" no se promete hasta Fase 2. Es el cuello de botella real, y
  es de **OIS**, no de EU.
- **Sin API server-to-server hoy** = Fase 1 usa la puerta pública anónima (`/public/site/{slug}/contact`).
- **WhatsApp multi-número sellado** = canal secundario hasta B5.
- **Dominio del tenant EU sin verificar** = config de OIS/Owner.
- **OGS gated** = no se construye hasta que el dolor esté mapeado; antes sería plataforma de gobierno
  "que no le habla a nadie".

---

## 8. Principio de oro (se repite porque es el corazón)

**OIS permanece agnóstico. EU jamás empuja su ontología cívica a las columnas de OIS: la mete en el
sobre genérico (`content`/`payload` JSONB) y la conserva en su piel. Si algo parece "necesitar un campo
en OIS", está mal modelado — va al sobre, o es una capacidad genérica (no cívica) que OIS expone para
todas sus verticales.**

---

_Referencias EU:_ `src/types/urban.ts`, `src/data/urban-signals.ts`, `src/config/urban-layers.ts`,
`src/data/ecosistema-content.ts`, `src/app/api/urban/*`, `src/components/{EcosistemaNarrative,UrbanHero,UrbanMap}.tsx`.
_Referencias OIS:_ `apps/backend-api/routers/{public_contact,public_site,whatsapp_webhook}.py`,
`modules/{events,memory,continuity,presence,execution,safeguard}`, `JusticeCase` (mig. 0038),
`docs/20-specs/{SPEC-API_v1,SPEC-DATA_v1.1,SPEC-T0_v1}.md`, seed `ecosistemaurbano`.
_Supera a:_ `docs/spec-arquitectura-ois.md`.
