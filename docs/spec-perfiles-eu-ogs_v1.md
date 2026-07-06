# SPEC — Perfiles de OGS: Ciudadano y Gobierno

Fecha: 2026-07-01
Estado: **autoritativo (vivo)**. Consolida lo construido y fija hacia dónde vamos **por perfil**, para
que las decisiones de producto se **deriven de aquí** (no ad-hoc). Compañero de
`spec-integracion-eu-ois_v1.md` (integración técnica EU↔OIS).

## 0. Por qué este documento

Tres funciones:

1. **Consolidar** — dejar claro qué hemos construido y **a quién sirve**.
2. **Dirigir** — fijar los perfiles a los que apuntamos (**Ciudadano primero, Gobierno después**) y qué recibe cada uno.
3. **Derivar** — convertir preguntas de alcance ("¿construyo la vista X ahora?") en decisiones **inherentes**, vía las reglas de la §6.

## 1. Encuadre (recap del modelo)

- **OGS** = sustrato doctrinal (rendición de cuentas pública). **OIS** = motor técnico (memoria/continuidad; plataforma de ClicNegocio). **Ecosistema Urbano (EU)** = la primera **piel** (perspectiva ciudadana). Detalle en `spec-integracion-eu-ois_v1.md`.
- Los **perfiles son perspectivas sobre el mismo lazo de rendición de cuentas**, sobre el mismo sustrato (OIS): **una piel por perspectiva**.
- **Secuencia pain-first:** Ciudadano → (OIS) → Gobierno. El dolor ciudadano se mapea primero; eso habilita priorizar política pública.
- Unidad territorial: **asentamiento** (urbano y rural). Licencia: **AGPL-3.0**. Repo: `clicnegocio-dev/OGS`.

## 2. Los perfiles (overview)

| Perfil                                     | Objeto que observa                                                     | Rol en el lazo                                    | Fase                                          |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| **Ciudadano** _(ahora)_                    | La ciudad / asentamiento (señales del territorio)                      | Emisor de señales · lector · decisor              | **MVP** (lectura pública + captura → OIS)     |
| **Gobierno** _(después)_                   | La **operación pública** (actos: trámites, obras, presupuesto, quejas) | Responde señales, rinde cuentas, ejecuta política | **OGS / Fase 3** (sobre OIS: JusticeCase, T2) |
| _(Futuras: medios, academia, dependencia)_ | Lentes derivadas sobre el mismo núcleo                                 | Amplifican / validan                              | Post-Gobierno                                 |

> **Lo que separa los perfiles es el objeto observado.** Ciudadano observa **la ciudad**; Gobierno observa **la operación del gobierno**. Ese giro _es_ el núcleo de OGS.

## 3. Perfil CIUDADANO (ahora)

**Quién:** habitante/vecino, familia (decidir dónde vivir), comercio local, colectivo/organización; y el decisor personal (invertir/participar). Medios y academia son sub-lentes cercanas (futuras).

**Trabajos por hacer (jobs-to-be-done):**

- Entender mi zona (¿cómo está? ¿qué señales hay?).
- Ver señales reales antes de decidir (vivir / invertir / participar).
- Reportar lo que observo (una señal, no una queja).
- Confiar en el dato (origen, fecha, confianza).
- Orientarme rápido; explorar por qué pasa.
- Dar seguimiento a mi señal (parcial hoy: se captura, la relectura es Fase 2).

**Qué le damos (consolidación de lo construido):**

| Necesidad                           | Vista / feature                                                                    | Estado                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| ¿Dónde? (espacial, digerible)       | **Mapa** MapLibre (capas, radio, 3 niveles punto/municipio/estado, clustering, 3D) | ✅                                            |
| Hojear todo                         | **Tablero** tipo lista (categoría / nivel / código postal + búsqueda)              | ✅                                            |
| Mi zona sintetizada                 | **Dossier por CP** (perfil socioeconómico + señales + últimas notas)               | ✅                                            |
| Reportar                            | **Captura in-app → puerta pública de OIS** (geo opcional + eje)                    | ✅ (activar: `OIS_BASE_URL` + dominio tenant) |
| Confiar en el dato                  | **Página Fuentes** (transparencia de proveedores, estado y confianza)              | ✅                                            |
| Orientarse / navegar                | **⌘K** (buscador global: asentamiento, colonia, CP, vista)                         | ✅                                            |
| ¿Por qué? / relaciones y tendencias | **Análisis** (tendencia oficial + relación entre zonas)                            | 🔜 propuesto (ver §7)                         |

**Datos que toca:** _lectura_ (efímera, no va a OIS) — DENUE, DataMéxico (perfil), Open-Meteo, USGS/EONET, prensa. _Escritura_ — su reporte → OIS.

**Doctrina:** honestidad (origen/fecha/confianza), anti-estigma (no convertir zona pobre en estigma inmobiliario), **no vigilar personas**, "reportes no verificados" marcados, nada decorativo.

**Fase:** casi todo **Ahora (MVP)**. Falta del perfil ciudadano: **releer** sus señales de vuelta (lectura desde OIS, Fase 2) y el **análisis robusto** (AGEB, OIS).

## 4. Perfil GOBIERNO (después)

**Quién:** ayuntamiento/alcaldía, dependencias (obras, servicios, agua, seguridad), atención ciudadana, transparencia, planeación/presupuesto.

**Trabajos por hacer:**

- Monitorear mi operación en el asentamiento.
- Recibir y **responder** señales/quejas con **responsable + estado + cierre**.
- **Rendir cuentas** (evidencia trazable, no propaganda).
- Detectar rezagos / incumplimientos / patrones.
- Priorizar **política pública** (señales → acción).
- **Continuidad institucional** (que el cambio de administración no borre la memoria).

**Qué le daríamos (el objeto OGS):**

- **Observar la operación pública:** obras, licencias, padrón de proveedores (**CKAN — ya construido, sin cablear**), Obra Pública Abierta, presupuesto.
- **El loop de rendición de cuentas:** `JusticeCase` de OIS (acto impugnado → responsable → estado → resolución → cierre + bitácora inmutable) — **ya construido en OIS**.
- **Señales → política pública:** un patrón de señales del asentamiento se vuelve acción priorizada y rastreable.
- **Tableros de operación** + **continuidad** (la memoria de OIS que sobrevive administraciones).

**El giro clave:** el objeto pasa de **la ciudad** (Ciudadano) a **la operación del gobierno** (Gobierno). Núcleo OGS: _"no vigila ciudadanos; vigila la operación pública para que el gobierno rinda cuentas."_

**Datos que toca:** registros de gobierno (CKAN, Obra Pública, presupuesto) + las señales ciudadanas que aterrizan en OIS.

**Fase:** **OGS / Fase 3, sobre OIS** (JusticeCase + T2 patrones + API de lectura). Requiere que el dolor ciudadano esté mapeado (secuencia). **No se fuerza antes.**

**Doctrina:** **no propaganda** (no vitrina de logros), trazabilidad con responsable/estado, no vigilar personas.

## 5. Matriz de consolidación (qué sirve a quién)

| Feature construida                      | Perfil primario      | También sirve a              | Fase                                |
| --------------------------------------- | -------------------- | ---------------------------- | ----------------------------------- |
| Mapa · Tablero · Dossier · ⌘K · Fuentes | Ciudadano            | Gobierno (contexto), medios  | Ahora                               |
| Captura in-app                          | Ciudadano (emite)    | Gobierno (recibe, en Fase 3) | Ahora (EU) / loop en OIS            |
| Fuentes / honestidad de dato            | Ciudadano            | Gobierno, medios, academia   | Ahora                               |
| Análisis (exploratorio)                 | Ciudadano            | Gobierno (diagnóstico)       | 🔜 ahora exploratorio / OIS robusto |
| CKAN operación pública · JusticeCase    | **Gobierno**         | Ciudadano (transparencia)    | Fase 3 (OGS/OIS)                    |
| Índice de decisión · patrones (T2)      | Ciudadano + Gobierno | —                            | Fase 2/3 (OIS)                      |

## 6. Reglas de derivación (para que las decisiones sean inherentes)

1. **Regla de perfil.** Toda vista/feature declara **perfil + fase**. Ciudadano = ahora (MVP). Gobierno = OGS/Fase 3.
2. **Regla de objeto.** ¿Observa **la ciudad** (Ciudadano) o **la operación de gobierno** (Gobierno)? Si es operación → perfil Gobierno → OGS/OIS.
3. **Regla de dato honesto.** Se construye **solo si el dato disponible la sostiene honestamente**. Si necesita N grande / AGEB / histórico / multi-fuente que no tenemos → es OIS; en el MVP se entrega **exploratoria-con-caveats** o como **placeholder** del futuro.
4. **Regla de secuencia (pain-first).** Ciudadano antes que Gobierno; el dolor mapeado habilita priorizar política pública.
5. **Regla de doctrina.** Declarar origen/fecha/confianza/estado; anti-estigma; no vigilar personas; no propaganda; nada decorativo.

## 7. Ejemplo derivado: la vista de Análisis (regresión)

Aplicando las reglas, la pregunta de alcance **se resuelve sola**:

- **Regla 1–2:** perfil **Ciudadano** (explorar relaciones de su zona), objeto **la ciudad** (señales) → **ahora**.
- **Regla 3:** la regresión _robusta y multi-capa_ necesita **AGEB (dato por manzana) = OIS**, ausente hoy. Por tanto en el MVP se entrega **exploratoria**: (A) **tendencia** oficial CONEVAL + (B) **correlación entre zonas** por CP, siempre con **N, R² y caveats** ("correlación ≠ causalidad"), más (C) un **placeholder** de la regresión robusta que llega con OIS.
- **Regla 5:** nada decorativo, límites declarados.

→ El alcance de la vista de análisis **queda derivado del perfil y la doctrina**, no negociado caso por caso. Ese es el objetivo de esta SPEC.

## 8. Roadmap por perfil

- **Ahora (Ciudadano / MVP):** cerrar el **Análisis exploratorio**; activar la captura en vivo (`OIS_BASE_URL` + verificar dominio del tenant); pulido continuo.
- **Fase 2 (OIS):** API de lectura `/api/v1/tenant/signals` (releer señales ciudadanas), **T2** (patrones por zona), **AGEB** → habilita el análisis robusto y la relectura ciudadana.
- **Fase 3 (Gobierno / OGS):** encender **CKAN / Obra Pública** como objeto; loop **JusticeCase**; **señales → política pública**; tableros de operación; continuidad institucional.

---

_Referencias:_ `spec-integracion-eu-ois_v1.md` (integración técnica), `arquitectura-analitica-4d.md` (las 4
dimensiones), `fuentes-datos-ecosistema-urbano.md` (catálogo de fuentes). Doctrina OGS y modelo de 3
líneas: memoria del proyecto.
