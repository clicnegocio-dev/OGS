# Arquitectura analítica — las 4 dimensiones de Ecosistema Urbano

> ♻️ **Reconciliado (2026-06-30).** Las capas analíticas siguen válidas como modelo, pero donde este
> doc dice "OIS" en el sentido de _backend propio a construir_ (PostGIS/worker), eso **ya existe en
> la plataforma OIS** y NO se construye en EU. La frontera correcta (EU = piel cívica; OIS agnóstico;
> el "señal→patrón" / T2 es capacidad genérica de OIS, no de EU) vive en **`spec-integracion-eu-ois_v1.md`**.

Fecha: 2026-06-29
Estado: vivo (lectura analítica de EU). La materialización de datos pesados es de la plataforma OIS
—ver `spec-integracion-eu-ois_v1.md`—, no de un backend propio de EU. Define cómo se organiza el dato
para responder, en orden de madurez, las cuatro preguntas de toda analítica urbana.

## 0. Por qué este documento

El SPEC define el contrato de evidencia y el corte MVP↔OIS. Este documento lo reorganiza por
**capacidad analítica**: cada fuente entra al sistema para servir a una (o varias) de las cuatro
dimensiones. La regla es que **no se salta de nivel sin cimiento**: sin descriptivo honesto no hay
diagnóstico; sin diagnóstico no hay predicción defendible; sin predicción la prescripción es opinión.

```
Descriptivo  → ¿Qué está pasando?      (estado y retrato de la zona)
Diagnóstico  → ¿Por qué pasa?          (cruce de capas, carencias, causas)
Predictivo   → ¿Qué va a pasar?        (tendencia y, con OIS, modelo)
Prescriptivo → ¿Qué conviene hacer?    (índice de decisión explicable)
```

## 1. Dimensión por dimensión: qué hay, qué falta, de dónde sale

### Descriptivo — ¿Qué está pasando?

| Señal                                       | Fuente                         | Estado               | Dónde                                               |
| ------------------------------------------- | ------------------------------ | -------------------- | --------------------------------------------------- |
| Clima, lluvia, calor, aire (AQI)            | Open-Meteo                     | ✅ vivo              | `/api/urban/weather`                                |
| Establecimientos / servicios                | INEGI DENUE                    | ✅ vivo              | `/api/urban/denue`                                  |
| Sismo / eventos ambientales                 | USGS / EONET                   | ✅ vivo              | `/api/urban/hazards`                                |
| **Población, pobreza, perfil**              | **DataMéxico (INEGI+CONEVAL)** | **✅ nuevo**         | **`/api/urban/profile`**                            |
| **Acceso a internet en el hogar**           | **INEGI housing (DataMéxico)** | **✅ nuevo**         | **`/api/urban/profile` → `descriptive.indicators`** |
| **Inseguridad percibida (gasto defensivo)** | **INEGI ENVIPE (DataMéxico)**  | **✅ nuevo (proxy)** | **`/api/urban/profile` → `descriptive.indicators`** |
| Límite del municipio                        | DENUE convex hull              | ⚠️ aproximado        | `/api/urban/boundary`                               |
| Inventario tabular municipal                | CKAN Veracruz                  | ⚠️ endpoint sin UI   | `/api/urban/ckan/veracruz`                          |
| Precio/renta por colonia                    | _scraping inmobiliario_        | ❌ pendiente         | —                                                   |

### Diagnóstico — ¿Por qué pasa?

| Cruce                              | Fuentes a combinar                                                     | Estado                                             |
| ---------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| **Carencias que explican la zona** | **CONEVAL (servicios básicos, salud, educación, vivienda)**            | **✅ nuevo (`/api/urban/profile` → `diagnostic`)** |
| Por qué se inunda                  | CENAPRED/CONAGUA × elevación (DEM) × suelo × drenaje (Censo) × eventos | ❌ OIS                                             |
| Por qué baja la vitalidad          | densidad DENUE × nivel socioeconómico × flujo                          | ⚠️ parcial (DENUE + perfil)                        |
| Por qué hay inseguridad percibida  | INEGI ENVIPE × espacio público × iluminación                           | ❌ (ENVIPE ya disponible en DataMéxico)            |

El perfil socioeconómico es el **primer cruce de capas real del sistema**: convierte la tesis
"nada está aislado" en dato. La carencia dominante de CONEVAL ya señala qué capa observar primero.

### Predictivo — ¿Qué va a pasar?

| Señal                              | Fuente                                         | Estado                                   |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Riesgo hídrico próximas 24 h       | Open-Meteo forecast                            | ✅ vivo (passthrough)                    |
| **Tendencia de pobreza 2010→2020** | **CONEVAL serie temporal**                     | **✅ nuevo (`predictive.povertyTrend`)** |
| Apertura/cierre de comercio        | DENUE cortes sucesivos                         | ❌ OIS (requiere histórico)              |
| Tendencia delictiva                | SESNSP mensual                                 | ❌ OIS                                   |
| Modelo de inundación               | forecast × susceptibilidad × historial colonia | ❌ OIS                                   |

> Honestidad: hoy "predictivo" = **tendencia observada**, marcada como tal (`basis`). La proyección
> modelada llega con OIS y su histórico. No se presenta una tendencia como pronóstico.

### Prescriptivo — ¿Qué conviene hacer?

| Salida                                      | Insumo               | Estado                                                       |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| **Señal de prioridad (carencia dominante)** | CONEVAL              | **✅ nuevo (`prescriptive.priority`), explicable y acotado** |
| Índice de decisión urbana (8 dimensiones)   | `urban_ageb_metrics` | ❌ OIS-2                                                     |
| Escenarios ("si mejora X, baja Y")          | índice + modelo      | ❌ OIS-3                                                     |

## 2. DataMéxico como atajo oficial del MVP

DataMéxico (Secretaría de Economía, sobre Tesseract OLAP) sirve **dato oficial ya agregado por
municipio y con serie temporal**, keyless. Esto adelanta dentro del MVP parte de lo que el SPEC
reservaba a OIS (Censo/socioeconómico), sin montar PostGIS todavía.

- Host vivo (verificado 2026-06-29): `https://www.economia.gob.mx/apidatamexico/tesseract`
  (el antiguo `api.datamexico.org` fue decomisionado).
- Cliente: `src/lib/datamexico.ts` (`fetchCube`, cut por `Municipality`, cache 24 h).
- Cubos integrados: `inegi_population`, `coneval_poverty`, `inegi_housing_basic` (internet),
  `inegi_envipe` (proxy de inseguridad: % de hogares con gasto en protección contra el delito,
  excluyendo el tramo "Undefined").
- Cubos disponibles aún sin integrar (97 en total): `inegi_economic_census`, `conapo_metro_area_population`,
  `economy_foreign_trade_mun`, `inegi_gdp`.
- **Descartado conscientemente:** `inegi_enoe` (empleo) — sus valores a nivel municipio son
  factores de expansión sumados, no conteos reales (p.ej. "fuerza laboral 466k" en un municipio
  de 144k hab); no es representativo a esa granularidad. El empleo se tomará de OIS/otra fuente.
  `inegi_economic_census` queda fuera por ahora: su corte más reciente en el cubo es 2014 (rancio)
  y DENUE ya cubre el inventario de establecimientos vigente.
- Límite: granularidad **municipio** (no AGEB). El detalle por AGEB sigue siendo OIS (Censo+PostGIS).

## 3. Contrato de endpoint nuevo

`GET /api/urban/profile?settlement=<id>` → `MunicipalProfile` con `dimensions.{descriptive,
diagnostic, predictive, prescriptive}`, cada métrica con `layer`, `year` y `unit`; `source.vintage`
y `confidence: "official"`. Degrada honestamente: si un cubo falla, esa parte queda nula, no inventada.

## 3 bis. Dato inmobiliario — veredicto de cumplimiento y vía elegida

Revisión 2026-06-29 de portales líderes (respetando robots.txt y ToS):

| Fuente                                    | Veredicto                                                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inmuebles24 / Vivanuncios                 | robots.txt permite listados y publican sitemaps, pero el WAF responde **403 a todo agente no-navegador**. Saltarlo (huella de navegador falsa + proxies) es **evasión de control de acceso** → no se hace. |
| Mercado Libre (scraping)                  | robots.txt **bloquea explícitamente ClaudeBot/GPTBot/PerplexityBot** (`Disallow: /`). No se scrapea.                                                                                                       |
| Lamudi / propiedades.com / casasyterrenos | Bloquean agentes no-navegador (403/405/timeout).                                                                                                                                                           |
| Facebook Marketplace                      | Sin API pública de listados, auth-gated; scraping viola ToS. Descartado.                                                                                                                                   |

**Vía elegida: API oficial de Mercado Libre** (única compatible con PRECIO por municipio/CP).

- Conector: `src/lib/mercadolibre.ts` (OAuth, resuelve location ids estado→ciudad, busca categoría
  `MLM1459`, normaliza listados, calcula inventario + mediana de precio + desglose por operación y CP).
- Ruta: `GET /api/urban/market?settlement=` → degrada honestamente a `configured:false` sin credenciales.
- **Setup (gratis):** crear app en https://developers.mercadolibre.com.mx → hacer el flujo OAuth
  (authorization_code) una vez → obtener `access_token` (6 h) o `refresh_token`. Pegar en `.env.local`
  (`ML_ACCESS_TOKEN` simple, o `ML_CLIENT_ID/SECRET/REFRESH_TOKEN`). `npm run verify:api` confirma.
- **Límite/OIS:** el `refresh_token` de ML rota en cada uso; persistirlo (y la ingestión periódica
  de inventario) es trabajo de OIS (worker + DB). El MVP consulta en vivo con token simple.

## 4. Orden de construcción recomendado

1. **✅ Hecho:** perfil socioeconómico oficial (descriptivo + diagnóstico + tendencia + prioridad).
2. Integrar ENVIPE + Censo económico de DataMéxico → cubre ejes seguridad y economía con dato oficial.
3. Surfacing del CKAN Veracruz (endpoint ya existe, sin UI).
4. **Scraping** (siguiente fase): medios locales → señales por colonia; portales inmobiliarios →
   precio/renta. Es lo único que ninguna fuente oficial entrega y desbloquea el caso "invertir".
5. OIS-1: capa AGEB en PostGIS para bajar de municipio a colonia y habilitar diagnóstico/predictivo finos.
