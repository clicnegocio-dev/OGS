# Auditoría profunda de cimientos — 2026-07-06

> Auditoría multi-dimensión (API/datos, frontend, pipeline de scraping, infraestructura de
> ingeniería, deriva visión↔código) ejecutada con 5 revisiones independientes + verificación manual
> de todos los hallazgos críticos contra el código. Documento de punto-en-el-tiempo: los hallazgos
> se marcan resueltos aquí mismo conforme se cierren.

## Estado de remediación (2026-07-06, misma sesión)

**RESUELTO — Fase 0 (honestidad) y Fase 1 (operación/tooling):**

- **C1** ✅ corroboración por evento (ventana temporal ±7 d + dedup de republicaciones) en
  `lib/news.ts`; tests nuevos. La inflación "Corroborada 4/4" colapsa a lo real.
- **C2** ✅ causa raíz: el sitemap de XEU estaba congelado (usábamos `sitemap-noticias.xml`; el vivo es
  `sitemap-noticias-25-26.xml`, al día de hoy). Snapshot regenerado (vintage 2026-07-06). Añadido
  `bySource` (conteo + fecha máxima por medio) al payload y banner de rezago en el tablero.
- **C3** ✅ CI (`.github/workflows/ci.yml`: format+lint+typecheck+test+audit+build) y cron semanal del
  scraper (`scrape-news.yml`).
- **A8** ✅ fantasma PostGIS enterrado (banner en `.sql`, README reescrito, `DATABASE_URL` fuera de
  `.env.example`).
- **A10** ✅ `/fuentes` deriva el corte del snapshot en vivo (drift-proof) y nombra los 3 medios;
  comentario de `confidence.ts` al día.
- **M17** ✅ 0 vulnerabilidades (`overrides` de postcss).
- **Tooling** ✅ prettier + `.editorconfig` + `.nvmrc` + `packageManager`; `lint --max-warnings=0`;
  fuentes migradas a `next/font` (elimina el warning y la fuga de IP a Google).
- **Robustez del parser** ✅ CDATA + entidades numéricas en el sitemap (BAJO).

**RESUELTO — Fase 2 (endurecer la API):**

- **C4** ✅ `boundary/route.ts`: `denueResult === null` (DENUE devolvió 0 puntos → se sirve semilla)
  ahora marca `degraded`, así una semilla por blip upstream ya NO se fija 24 h + CDN.
- **A2** ✅ los fetch de DENUE usan `cache: "no-store"` (la URL lleva el token; la cache propia cubre
  el TTL) → el token deja de escribirse en la Next Data Cache.
- **A1** ✅ (a) `cache.ts`: eviction POR NAMESPACE (un flood de `geo:<ip>` o de `condition` no desaloja
  `denue-dataset`/`ml-access-token`); (b) `report/route.ts`: rate-limit best-effort por IP + tope de
  Content-Length (10 KB) + validación de severidad; (c) `denue/route.ts`: `condition` acotada
  (longitud + espacios). Tests nuevos (`tests/api-hardening.test.ts`).

**PENDIENTE** (siguientes fases, por prioridad): A4/A5/A6 (deep-link `?cp` roto en SPA, carrera de
tema del mapa, fallos parciales invisibles), A9 (narrativa en tiempo honesto), A3 (refresh ML), M1
(sobre común de metadatos + weather/EONET), M2/M3/M18 (vintage DENUE, maxRecords, bySource en más
endpoints), M6/M8/M9 (ids/selección/revalidación del scraper), M13 (a11y), M14 (más tests de rutas
API), y los BAJOS (404 en settlement desconocido, retirar market/ckan huérfanos, etc.). El resto
sigue listado abajo con su evidencia.

## Resumen ejecutivo

El código está **por encima del MVP promedio**: build/typecheck/tests verdes, secretos limpios
(verificado contra todo el historial git), fetch con timeout en todas partes, anti-stampede,
semillas demo etiquetadas, degradación honesta diseñada (no improvisada), ciclo de vida de MapLibre
correcto, formulario con feedback completo, licencia AGPL seria.

La deuda tiene un patrón claro: **el producto promete honestidad y hoy la incumple en 4 puntos
medibles** (confianza inflada, dataset medio congelado, /fuentes desactualizada, fantasma PostGIS),
**no existe ninguna operación** (0 CI, 0 cron, dato horneado en el build), y **la capa API es
abusable** (0 rate-limiting, cache vaciable por el cliente, relay abierto a OIS).

Implementación real: ~85-90% de la Parte A comprometida (EU piel cívica); ~30-35% de la visión
completa OGS/OIS/EU (consistente con el scorecard previo). La paradoja central: **el código
subvende (etiqueta, degrada, avisa) mientras tres textos sobrevenden** (README §PostGIS, narrativa
del kernel, /fuentes).

---

## Hallazgos CRÍTICOS (verificados manualmente)

### C1. La confianza "Corroborada 4/4" se infla estructuralmente

`src/lib/confidence.ts:45` — `sources >= 2` ⇒ corroborada, **incondicional**: sin ventana temporal
ni similitud de evento. Con 2 medios activos, 21 de 58 cubetas CP+tipo (que cubren **441/500
señales**) marcan 4/4 solo porque ambos medios publicaron _algo_ de ese tipo en ese CP — con lapsos
de hasta 1,130 días (`91700|clima`). Además 5 grupos de títulos idénticos del mismo medio inflan
`mentions`. El comentario del propio archivo anticipaba el multi-medio pero no la inflación.
**Es el riesgo reputacional máximo: el sello de máxima confianza miente hoy.**
Fix: corroborar por evento (ventana ±7 días + mismo tipo/CP) y dedup de títulos casi idénticos.

### C2. 54% del dataset tiene ~1 año y el "corte" visible lo enmascara

Verificado: las 272 señales de XEU van de 2025-06-12 a **2025-08-02** (su sitemap declarado dejó de
actualizarse; el `sitemap-noticias-25-26` que anuncia su robots.txt da 404). El `vintage` mostrado
(2026-06-29) viene de Plumas Libres y oculta el hueco. No hay métrica por-fuente en el payload que
lo delate. Fix: `bySource`/`maxObservedAt` por fuente en payload, ventana máxima de antigüedad,
banner de staleness, e investigar el sitemap vivo de XEU.

### C3. Cero CI/CD y cero cron: el dato es manual y nada protege `main`

No existe `.github/`, ni vercel.json, ni hooks. `lint`/`typecheck`/`test` solo corren si alguien se
acuerda. El snapshot (572 KB) se importa **estáticamente** (`src/lib/news.ts:4`): refrescar dato =
script manual + commit + rebuild + redeploy. Si nadie lo corre 3 meses, la app sirve dato viejo sin
aviso. Fix: workflow CI (lint --max-warnings=0 + typecheck + test + audit) y workflow cron semanal
del scraper.

### C4. Boundary fija la semilla degradada 24h + CDN 1 semana, derrotando su propia mitigación

`src/lib/denue-service.ts:187-198` — en fallo de red/HTTP, `fetchAreaDataset` NO lanza (hace
`break` y devuelve `businesses: []`). Con 0 puntos, `buildDataDrivenBoundary` → null →
`degraded = false` en `boundary/route.ts:31-38` → `shouldCache` pasa y se emite
`s-maxage=86400, stale-while-revalidate=604800`. Un blip de INEGI envenena el edge una semana con
la frontera semilla — exactamente lo que el comentario de la línea 66 dice evitar.
Fix: tratar `denueResult === null || !completeness.complete` como degradado.

---

## Hallazgos ALTOS

### API / plataforma

- **A1. Superficie de abuso sin rate-limiting** — `report/route.ts` es un relay abierto hacia OIS
  (PII incluida) sin límite de tasa ni de tamaño de body (`request.json()` sin verificar
  Content-Length); no existe `src/middleware.ts`. `geo/route.ts:39-43` deriva claves de cache de
  headers IP spoofeables; `denue` acepta `condition` de cardinalidad libre → 80 requests fabricadas
  vacían toda la cache LRU compartida (`cache.ts:13`), queman cuota INEGI y matan la geolocalización
  (free tier de ipapi.co).
- **A2. Token DENUE persistido en la Next Data Cache** — `denue-service.ts:185,244` pasa URLs con
  el token en el path a `next: { revalidate: 86400 }`, escribiéndolas como clave del fetch-cache en
  disco. El comentario de `denue.ts:161-166` advierte exactamente contra esto. Fix: `cache: "no-store"`
  (la cache propia con `cached()` ya cubre).
- **A3. Refresh token de MercadoLibre se auto-invalida** — `mercadolibre.ts:35-60`: ML rota el
  refresh_token y el nuevo solo se avisa por `console.warn`; tras evicción/cold-start el conector
  muere hasta intervención manual. Fix MVP: modo manual-only con `ML_ACCESS_TOKEN`.

### Frontend

- **A4. Deep-link `?cp` roto en navegación SPA** — `UrbanHero.tsx:154-161`, `NewsBoard.tsx:49-57`
  leen la query en `useEffect [..[]..]`; la palette navega con `router.push` sin remontar → elegir
  colonia en ⌘K estando ya en la página no enfoca nada. La feature insignia "mapa↔tablero
  conversan" solo funciona con recarga dura. Fix: `useSearchParams()` + filtros escritos a URL.
- **A5. Carrera en cambio de tema del mapa** — `UrbanMap.tsx:167-177`: `once("styledata")` dispara
  con el estilo a medio cargar y se apila entre toggles rápidos → señales desaparecidas o tema
  mezclado. Fix: `style.load` + cancelar handler anterior.
- **A6. Fallos parciales de API invisibles** — `UrbanHero.tsx:144-147`: solo avisa si fallan LAS 7
  fuentes; si cae 1 (p.ej. news), el usuario ve menos señales sin aviso — contra el lema "Sin datos
  ≠ sin problema". Fix: banner granular con las fuentes caídas.
- **A7. Toggle de tema perdido durante carga inicial** — `mapRef.current` se asigna dentro de
  `map.on("load")`; togglear antes no-opea. Fix: asignar al crear o re-aplicar tema en `load`.

### Deriva visión↔código ("deuda emocional")

- **A8. El fantasma PostGIS** — `README.md` §PostGIS presenta como "ruta esperada" el backend que
  `spec-integracion-eu-ois_v1.md` §2 prohíbe; `docs/postgis-schema.sql` no lleva banner (y difiere
  del esquema de `spec-arquitectura-ois.md` §5 — dos esquemas muertos y distintos);
  `.env.example` conserva `DATABASE_URL`. Única contradicción frontal con el doc autoritativo.
- **A9. La narrativa vende el kernel en presente** — `ecosistema-content.ts`: "El sistema detecta
  zona, frecuencia y eje" (la spec declara que T2 "no existe en ningún repo todavía"); "Red Local…
  aun sin internet, salto a salto entre vecinos" (una red mesh que no existe en ninguna spec);
  "operado por OIS" cuando la lectura es 100% local a EU. El formulario sí tiene tiempo honesto; el
  Flujo/Kernel no.
- **A10. /fuentes — la promesa central — está desactualizada** — `data-sources.ts:92-103` dice
  "XEU, corte 2025-08-02" cuando son 3 medios con corte 2026-06-29; el comentario de
  `confidence.ts:5-7` describe una limitación ("un solo medio, 4/4 inalcanzable") que ya no existe.

---

## Hallazgos MEDIOS (selección accionable)

- **M1. Cuatro dialectos para "degradado"** — boundary/hazards usan `degraded`, weather degrada en
  silencio (aire caído = `air:null` cacheado 30 min sin flag), denue usa `completeness.complete`,
  profile usa `partial`. Fix: sobre común `{ degraded, timestamp, confidence, source, vintage }` en
  las 11 rutas.
- **M2. Vintage DENUE hardcodeado "2024-11"** servido como `observedAt` de cada señal
  (`denue-service.ts:95`) — hoy casi seguro falso (INEGI lleva ~3 cortes más). Config/env + formato ISO.
- **M3. `completeness.maxRecords: 50000` es mentira estructural** — techo real 15 páginas × 1000.
- **M4. EONET `limit=100` global sin bbox** — eventos dentro del radio pueden quedar fuera y la
  fuente se declara "ok" (`hazards/route.ts:145`).
- **M5. Sección "veracruz" de XEU mete municipios ajenos** (Tlalixcoyan, Medellín…) al centroide
  del puerto con CP 91700 (~10% de esa sección). Lista negra o degradar a estado.
- **M6. Ids slug-based inestables** (plumaslibres/eldictamen): slug editado ⇒ señal duplicada;
  mismo slug en años distintos ⇒ nota descartada en silencio. Fix: hash de URL canónica.
- **M7. Clasificador ~13% FP** con patrones sistemáticos ("fila para el concierto"→movilidad,
  "mercado Malibrán"→comercio, "marchas forzadas"→social) y 24 pronósticos meteorológicos rutinarios
  que hacen de clima el tipo #1. Stems negativos + colapsar pronósticos.
- **M8. Selección por `lastmod` pre-enriquecimiento + sort por scope** — una señal "punto" de 2023
  desplaza a una municipal de hoy; 0 señales "estado" sobreviven el corte (rama muerta en scopeNews);
  `PER_SOURCE_CAP = MAX_SIGNALS` no limita nada. Cuota por fuente real + ventana 12 meses.
- **M9. `loadPriorEnrichment` nunca revalida** (nota corregida por el medio queda stale para
  siempre) y pierde enriquecimiento de señales que salen del top-500.
- **M10. UrbanHero componente-dios** (573 líneas, ~9 responsabilidades) y `EcosistemaNarrative`
  client-side siendo 95% estático (viaja entero en el bundle de la ruta más pesada).
- **M11. Doble fetch de `/api/urban/profile`** — TendenciaPanel lo pide en cliente cuando la página
  de análisis ya es server component (SSG-able como `cpData`).
- **M12. Dark mode a medias** — el toggle solo re-tematiza el hero; la narrativa no tiene variante
  oscura; no persiste ni respeta `prefers-color-scheme`.
- **M13. A11y**: contraste `--muted` #9a9c98 ≈ 2.7:1 (falla AA en textos de 11-13px); roving
  tabindex sin `.focus()` en tabs de Análisis; tablist de narrativa sin manejo de flechas; señales
  del mapa inalcanzables por teclado (mitigado parcialmente por /noticias, pero DENUE/semilla no
  tienen equivalente en lista).
- **M14. Cobertura de tests ~17%** — 11 rutas API y 11 componentes con 0 tests; los route handlers
  son funciones `GET(Request)` testeables directamente en Vitest.
- **M15. ESLint no falla con warnings** (sin `--max-warnings=0`) y sin prettier/.nvmrc/packageManager.
- **M16. Observabilidad inexistente** — 7 `console.*` sueltos, sin logger estructurado, sin
  `/api/health`, sin error tracking.
- **M17. 2 vulnerabilidades moderadas** vía next→postcss (GHSA-qx2v-qp2m-jg93); resolver con
  override o upgrade de next.
- **M18. El Dictamen acreditado sin aportar** — `payload.source` lista los 3 medios estáticamente
  pero hay 0 señales `eldictamen-*` (su sitemap solo cubre ~48h). Emitir `bySource` real.
- **M19. Robots: crawl-delay ignorado** (pico ~11 req/s con 4 workers), matching de UA por
  `includes` bilateral, fail-open sin límite.
- **M20. Geografía degenerada** — 88.6% del dato colapsa en 2 CPs de respaldo municipal; solo 22.2%
  logra colonia. El gazetteer de 20 colonias (~2-4% de cobertura real) define el techo del producto;
  migrar a SEPOMEX como dataset generado.

## Hallazgos BAJOS (selección)

- `getSettlement()` con fallback silencioso a boca-del-rio para ids basura (profile/denue/market
  responden 200 con datos de otro municipio).
- Endpoints huérfanos: `/api/urban/market` + `mercadolibre.ts` y `/api/urban/ckan/veracruz` sin
  ningún consumidor — decidir: cablear o retirar (mientras existan son superficie de abuso gratuita).
- Código muerto: `NO_STORE_HEADERS` (http.ts:37), `DENUE_CATEGORY_LABEL` (denue.ts:153).
- Ontología del reporte sin validar contra las uniones existentes (layer/severity como string libre).
- IP del visitante enviada a ipapi.co sin aviso de privacidad (LFPDPPP); User-Agent expone correo personal.
- La coordenada exacta del dispositivo viaja por red (el server redondea, el cliente no).
- `#participa` no reabre el formulario la segunda vez (hash sin limpiar).
- Google Fonts por `<link>` en vez de `next/font` (render-blocking + fuga de IPs).
- CSS duplicado por página (`.board-back`/`.an-back`/`.fuentes-back` = mismo bloque × 3).
- Parser de sitemap: CDATA/gz sin soporte, `lastmod` sin validar, presupuesto de 5 sub-sitemaps
  toma los primeros del índice (si WP lista años ascendente, lee los viejos).
- Títulos truncados de XEU (`"Prevén"`) — fallback al slug si `cleanTitle` < 15 chars.
- Vocabulario: OSIRIS/OIS/OGS (4 sentidos, 2 muertos); dos taxonomías llamadas "confidence";
  6 capas narrativas vs 5 de datos vs 6 de mapa; `geoScope` en español entre valores en inglés.
- Env sin documentar: `SCRAPE_ENRICH_LIMIT`, `ECOSISTEMA_BASE_URL`.
- CodeGraph sin inicializar (`.codegraph/` no existe) pese a estar configurado el MCP.

---

## Lo que SÍ está firme (no romper)

- Higiene de secretos verificada contra todo el historial git; `.gitignore` endurecido.
- Solo 4 deps de producción, todas legítimas; lockfile consistente.
- Todos los fetch con `AbortSignal.timeout`; sobre de error uniforme que no filtra detalle.
- Ciclo de vida de MapLibre sin leaks (cleanup completo, refs-espejo de manual).
- `AbortController` + `Promise.allSettled` en el hero; MapLibre fuera del server bundle.
- Semillas demo triple-etiquetadas (payload + badge + /fuentes); escapado HTML del popup;
  `isSafeHttpUrl`; blur real de señales agregadas; `prefers-reduced-motion` respetado.
- Pipeline de scraping: robots en runtime con tests, head-only con abort, 0 fechas
  malformadas/futuras, 0 URLs duplicadas, 99.8% con asunto citable limpio.
- Tests existentes bien diseñados (invariantes, no números frágiles); solo 2 TODOs en todo el repo.
- README y `.env.example` de calidad; licencia AGPL con racional documentado.

---

## Plan de cimientos (orden de ejecución)

### Fase 0 — Detener las mentiras activas (honestidad; el pitch del producto)

1. C1: corroboración por evento (ventana temporal) + dedup de títulos. Tests.
2. C2: `bySource`/staleness por fuente en payload + ventana de antigüedad + banner UI; investigar
   sitemap vivo de XEU.
3. A10: actualizar `/fuentes` (`data-sources.ts`) y comentario de `confidence.ts`.
4. A8: enterrar PostGIS (banner en .sql, reescribir README §PostGIS, limpiar `.env.example`).
5. A9: narrativa a tiempo honesto (Flujo/Kernel/Red Local/"operado por OIS").
6. M2+M3+M18: vintage DENUE a config, maxRecords real, source derivado de fuentes que aportan.

### Fase 1 — Operación (CI/CD; sostiene todo lo demás)

1. `.github/workflows/ci.yml`: lint `--max-warnings=0` + typecheck + test + `npm audit --audit-level=high`.
2. Workflow cron semanal del scraper (scrape → commit → deploy) + banner de staleness si
   `generatedAt` > 30 días.
3. Prettier + `.nvmrc` + `packageManager`; resolver el warning de fonts (`next/font`).
4. M17: override de postcss.

### Fase 2 — Endurecer la API

1. C4: boundary trata dataset vacío/incompleto como degradado.
2. A1: rate-limit best-effort + tope de body en `/report` + validación de ontología; claves de cache
   con namespaces y redondeo; allowlist de `condition`; no derivar claves de headers spoofeables.
3. A2: `cache: "no-store"` en fetch DENUE.
4. M1: sobre común de metadatos en las 11 rutas (weather declara degradación; EONET bbox).
5. A3: ML modo manual-only. Bajos: 404 en settlement desconocido; retirar o cablear market/ckan.

### Fase 3 — Frontend correcto

1. A4: `useSearchParams` + filtros en URL + `<Link>` en navegación interna.
2. A5+A7: `style.load` con cancelación; `mapRef` temprano.
3. A6: banner granular de fuentes caídas.
4. M13: contraste `--muted`, focus en roving tabindex, tablist con flechas.
5. M11: perfil como prop SSG (elimina doble fetch). M10/M12 diferibles con issue.

### Fase 4 — Tests de la capa de riesgo

1. Route handlers en Vitest (news, denue, boundary, report, weather) con fetch mockeado.
2. `vitest --coverage` con umbral inicial realista.
3. Tests de la nueva corroboración por evento y del rate-limit.

### Fase 5 — Calidad del dato (iterativa, post-cimientos)

1. M6: ids por hash de URL canónica (con migración de prior).
2. M8: selección por fecha real + cuota por fuente + ventana 12 meses.
3. M7: stems negativos + colapso de pronósticos. M5: lista negra de municipios ajenos.
4. M9: revalidación por lastmod. M19: crawl-delay + concurrencia 2.
5. M20: gazetteer SEPOMEX generado (el techo del producto).
