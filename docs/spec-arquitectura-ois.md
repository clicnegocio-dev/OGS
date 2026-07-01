# SPEC — Arquitectura robusta de Ecosistema Urbano sobre OIS

> ⚠️ **SUPERADO (2026-06-30).** Este documento especificaba un backend propio para EU
> (PostGIS, worker de ingestión, `urban_reports`) que **ya existe en OIS** — construirlo aquí
> sería **duplicar** el backend. La integración correcta (EU = piel cívica sobre OIS, que es
> agnóstico y no crea campos para EU) vive ahora en **`spec-integracion-eu-ois_v1.md`**.
> Se conserva este archivo como historia; **no construir desde aquí.**

Fecha: 2026-06-27
Estado: ~~borrador de referencia~~ **SUPERADO** — ver `spec-integracion-eu-ois_v1.md`.

## 0. Cómo leer este documento

El sitio actual es un **MVP** que prioriza acercarse a la realidad con fuentes ligeras y keyless (Open-Meteo, DENUE, USGS/EONET) renderizadas en un hero MapLibre vivo. Todo lo que exige **infraestructura persistente, ingestión pesada o cómputo offline** NO se construye en el MVP: se especifica aquí para construirse sobre **OIS** (Sistema de Inteligencia Operativa) cuando el proyecto pase de "demostrar la idea con datos reales" a "operar como observatorio".

Regla de corte MVP ↔ OIS:

- **MVP (cliente + API routes keyless/edge):** cualquier fuente que se consuma en vivo, sin token o con token simple, sin parsear shapefiles ni CSV masivos, y que quepa en el tiempo de una API route serverless.
- **OIS (worker + base de datos + cron):** cualquier fuente que requiera descargar/parsear datasets grandes, geometría oficial, agregación territorial, persistencia, verificación humana o materialización.

## 1. Principios no negociables (heredados del plan)

1. **Honestidad de datos:** cada señal declara fuente, fecha, cobertura, confianza y privacidad. Una capa sin trazabilidad no entra al mapa operativo.
2. **Distinguir** reporte ciudadano / dato oficial / inferencia / análisis — nunca mezclarlos sin marcarlo.
3. **"Sin datos" ≠ "sin problema":** estado explícito de *no medido* vs *medido sin incidencias*.
4. **Anti-estigma:** agregar o difuminar cuando el detalle pueda etiquetar hogares, personas o convertir una zona en estigma inmobiliario.
5. **Supervisión humana:** OIS opera con orden, trazabilidad y criterio; la automatización no sustituye el juicio editorial ni a las autoridades.

## 2. Modelo de datos canónico (contrato de evidencia)

Toda señal —reporte, dato oficial, inferencia, análisis— se normaliza al mismo contrato. Hoy hay tipos solapados (`UrbanSignal`, `UrbanMapSignal`, `UrbanHazard`, `MapPoint`); OIS los consolida en uno.

```ts
type EvidenceSignal = {
  id: string;                      // estable y deduplicable
  scope: { country: string; state: string; municipality: string; ageb?: string; block?: string };
  geometry: GeoJSON.Geometry;      // punto, línea o polígono (no solo lat/lng)
  layer: "ambiental" | "urbano" | "social" | "economico" | "institucional" | "tecnologia";
  axis?: string;                   // uno de los 8 ejes (síntoma)
  type: string;                    // taxonomía cívica fina (inundacion, banqueta, farmacia, ...)
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: "reported" | "official" | "inferred" | "analysis";
  privacy: "public" | "aggregated";
  source: { name: string; url?: string; vintage: string }; // vintage = fecha real del corte
  observedAt: string;              // antigüedad real del dato (no la del fetch)
  updatedAt: string;               // cuándo lo refrescó el sistema
  coverage?: { unit: "ageb" | "block" | "municipality"; measured: boolean };
};
```

Validación en el borde `fetch → tipo` con un validador runtime (p. ej. zod) para que ninguna fuente nueva corrompa el contrato.

## 3. Arquitectura de capas

```
Fuentes oficiales/abiertas
        │  (ingestión OFFLINE: cron/worker)
        ▼
PostGIS  ── boundaries · signals · agregados_por_ageb · reportes
        │  (consultas espaciales materializadas)
        ▼
API (Next.js route handlers / edge)  ── lee PostGIS + fuentes live (clima/sismo)
        │  (cache, bbox/tiles, conteos)
        ▼
Cliente MapLibre  ── hero vivo + narrativa editorial
```

- **Live (MVP, se queda en edge):** clima/precipitación (Open-Meteo), aire (Open-Meteo AQ), sismo (USGS), eventos (EONET), geoloc IP.
- **Materializado (OIS, PostGIS):** límites oficiales, Censo/Entorno Urbano por AGEB, inundación CENAPRED, DENUE agregado, reportes ciudadanos.

## 4. Pipeline de ingestión offline (resuelve el blocker de producción)

**Problema actual:** la ingestión DENUE es secuencial (hasta 50 páginas × 20 s) dentro de una API route sin `maxDuration` → timeout serverless garantizado, y cachea datasets parciales 24 h envenenando mapa y boundary.

**Solución OIS:**

1. **Worker/cron** (fuera del request) descarga DENUE por municipio completo, normaliza y escribe en `urban_signals` + agregados por AGEB. Cadencia: semestral (sigue el corte real de INEGI).
2. La API route ya **solo lee** PostGIS por bbox/AGEB → respuesta en milisegundos, sin riesgo de timeout.
3. **Nunca** se materializa un corte incompleto (`complete=false`): si la ingestión falla, se conserva el último corte bueno y se registra en bitácora.
4. `observedAt` = vintage real del corte INEGI; `updatedAt` = fecha de la corrida del worker.

Mismo patrón para Censo, Entorno Urbano y CENAPRED.

## 5. Esquema PostGIS

```sql
-- Límites oficiales (sustituye el convex hull "denue-derived" del MVP)
create table urban_boundaries (
  id text primary key,
  name text not null,
  level text not null,                  -- municipio | ageb | manzana
  inegi_code text,                      -- p.ej. 30028 / AGEB / clave de manzana
  source text not null,
  source_vintage text,
  geom geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz default now()
);
create index urban_boundaries_geom_idx on urban_boundaries using gist (geom);

-- Señales (evidencia) con geometría real
create table urban_signals (
  id text primary key,
  layer text not null,
  axis text,
  type text not null,
  title text not null,
  description text,
  severity text not null,
  confidence text not null,             -- reported | official | inferred | analysis
  privacy text not null,                -- public | aggregated
  source_name text not null,
  source_url text,
  source_vintage text,
  observed_at date,
  updated_at timestamptz default now(),
  geom geometry(Geometry, 4326) not null
);
create index urban_signals_geom_idx on urban_signals using gist (geom);
create index urban_signals_layer_idx on urban_signals (layer);

-- Agregados por AGEB (Censo, Entorno Urbano, DENUE derivado): la unidad de decisión
create table urban_ageb_metrics (
  ageb_code text primary key,
  municipality text not null,
  -- cobertura de servicios básicos (Censo)
  pct_drenaje numeric, pct_agua numeric, pct_electricidad numeric,
  nivel_socioeconomico text, escolaridad_promedio numeric,
  -- caminabilidad / entorno urbano
  pct_banqueta numeric, pct_alumbrado numeric, pct_rampa numeric, pct_arbolado numeric,
  -- acceso a servicios (DENUE derivado)
  dist_hospital_m numeric, dist_escuela_m numeric, dist_mercado_m numeric, dist_farmacia_m numeric,
  densidad_comercial numeric,
  -- riesgo
  susceptibilidad_inundacion text,      -- baja | media | alta (CENAPRED/CONAGUA)
  source_vintage jsonb,
  geom geometry(MultiPolygon, 4326)
);
create index urban_ageb_metrics_geom_idx on urban_ageb_metrics using gist (geom);

-- Reportes ciudadanos (MVP3)
create table urban_reports (
  id uuid primary key default gen_random_uuid(),
  layer text not null,
  zone text,
  text text not null,
  status text not null default 'pending',   -- pending | verified | resolved | rejected
  identity text not null default 'anon',     -- anon | verified
  author text,
  confirms int default 0,
  geom geometry(Point, 4326),
  created_at timestamptz default now()
);

-- Filtrado espacial de señales por asentamiento (contrato ya pensado en el MVP)
-- select s.* from urban_signals s
--   join urban_boundaries b on b.id = $1
--   where st_intersects(s.geom, b.geom);
```

## 6. Fuentes oficiales — plan de integración

| Fuente | Señal/decisión | Acceso | Unidad | Capa | Dónde corre | Prioridad |
|---|---|---|---|---|---|---|
| Open-Meteo (precip/temp) | Riesgo hídrico, calor | API keyless | punto | ambiental | **MVP (edge)** | ✅ hecho |
| Open-Meteo Air Quality | Calidad del aire (PM2.5/AQI) | API keyless | punto | ambiental | **MVP (edge)** | ✅ en curso |
| DENUE | Acceso a servicios, vitalidad | API + token | punto→AGEB | social/econ/inst | MVP live → **OIS agregado** | ✅ MVP / OIS |
| Censo 2020 (ITER/AGEB) | Drenaje/agua/luz, socioeconómico, escolaridad | CSV keyless | AGEB | social/urbano | **OIS (worker)** | P0 |
| Entorno Urbano 2020 | Banqueta, alumbrado, rampa, árbol, drenaje pluvial | CSV por manzana | manzana | urbano/social | **OIS (worker)** | P0 |
| CENAPRED / CONAGUA | Susceptibilidad a inundación | Shapefile | polígono | ambiental/riesgo | **OIS (worker)** | P0 |
| Marco Geoestadístico 2020 | Límite oficial AGEB/manzana | Shapefile | polígono | base | **OIS (worker)** | P1 |
| SESNSP | Seguridad cotidiana agregada | CSV mensual | municipio | institucional | **OIS (worker)** | P1 |
| INEGI Indicadores | Dossier municipal (series) | API + token | municipio | dossier | OIS o MVP edge | P1 |
| CKAN Veracruz (379 ds) | Licencias, obras, servicios | CKAN API | recurso | varias | **OIS (worker)** | P2 |
| USGS / EONET | Sismo/eventos (contexto secundario) | API keyless | punto | riesgo | **MVP (edge)** | ✅ hecho |

## 7. Capa de evidencia derivada e índice de decisión

Sobre `urban_ageb_metrics`, OIS calcula el **índice de decisión urbana** (Fase 3): explicable, nunca opaco. Cada dimensión muestra evidencia, fecha, fuente y peso:

- Seguridad cotidiana · Riesgo ambiental · Movilidad real · Servicios básicos · Acceso económico · Vitalidad comercial · Confianza institucional · Calidad del espacio público.

El índice se publica por AGEB con su desglose; jamás como una calificación única sin desagregar la evidencia. Anti-estigma: se muestran patrones y carencias estructurales, no etiquetas de "barrio malo".

## 8. Backend de reportes ciudadanos (MVP3)

Hoy el reporte vive en el HTML estático (localStorage + WhatsApp). OIS lo migra a:

1. `POST /api/urban/reports` → valida, geocodifica por zona/colonia, escribe en `urban_reports` (status `pending`).
2. Flujo de verificación humana: `pending → verified → resolved`. Los reportes repetidos en una zona elevan prioridad.
3. Privacidad: modo anónimo (sin PII) vs con cuenta (consentimiento explícito). Los puntos se **agregan/difuminan** antes de publicarse si pueden identificar hogares.
4. `GET /api/urban/signals` incluye reportes verificados como capa `reported`, distinguibles visualmente de lo oficial.
5. API pública de señales agregadas + exportación anonimizada.

## 9. Contratos de API objetivo

| Ruta | Lee de | Notas |
|---|---|---|
| `GET /api/urban/geo` | ipapi | ciudad detectada (live) |
| `GET /api/urban/weather` | Open-Meteo | hídrico + aire + calor (live, MVP) |
| `GET /api/urban/hazards` | USGS/EONET | contexto regional (live) |
| `GET /api/urban/signals?bbox=&layer=` | PostGIS | reportes + oficiales materializados |
| `GET /api/urban/boundary?id=` | PostGIS | límite oficial (Marco Geoestadístico) |
| `GET /api/urban/metrics?ageb=` | PostGIS | métricas + índice por AGEB |
| `GET /api/urban/dossier?id=` | PostGIS/INEGI | dossier real (no Wikipedia) |
| `POST /api/urban/reports` | PostGIS | alta de reporte (MVP3) |

Todas con cache-control y, para datos materializados, servicio por bbox/tiles para no volcar miles de puntos al cliente (clustering/heatmap).

## 10. Mapeo a los pilares OIS

- **Datos** → ingestión + `urban_signals` (Radar de señales).
- **Inventario** → `urban_boundaries` + `urban_ageb_metrics` (capas, zonas, patrones).
- **Operaciones** → pipeline señal→patrón→evidencia→acción + verificación de reportes.
- **Gobernanza** → contrato de evidencia, privacidad/agregación, bitácora de datasets, supervisión humana.
- **Comunicación** → Red Local (malla ciudadana) y API pública de señales.

## 11. Roadmap de construcción

1. **MVP (ahora):** fuentes live keyless en edge + narrativa + honestidad de cobertura. *Acercarse a la realidad sin infraestructura.*
2. **OIS-1 (PostGIS + worker):** ingestión offline DENUE/Censo/Entorno Urbano + límites oficiales. Resuelve el blocker de timeout y sustituye semillas por dato real por AGEB.
3. **OIS-2 (índice + dossier):** índice de decisión explicable + dossier municipal real.
4. **OIS-3 (reportes + API pública):** backend de reportes con verificación, exportación anonimizada, Red Local.

> El MVP debe poder decir con honestidad: *"Esto es lo que ya se mide en vivo; esto otro llega cuando OIS lo materialice."* Este SPEC es ese "esto otro".
