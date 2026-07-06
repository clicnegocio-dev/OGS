# `scraping/` — fuentes por scraping (plano de LECTURA, **efímero**)

Carpeta dedicada para todo el **scraping** de Ecosistema Urbano. Es el **plano de lectura**: datos que
EU _consulta_ de la ciudad (medios, etc.), que viven de forma **efímera** en EU y se pintan en el mapa.
**No viajan a OIS.** La ingestión _persistente_ de estas señales (y su conversión en memoria/patrones)
es trabajo de **OIS en Fase 2** — ver `docs/spec-integracion-eu-ois_v1.md`. Aquí solo materializamos un
snapshot que la API _solo lee_; nada de scraping en request-time.

## Cumplimiento

- Se respeta `robots.txt` **en tiempo de ejecución** (`news/robots.mjs`), no por comentario: antes de
  leer el `<head>` de una nota se consulta robots; si un medio veda la ruta, esa nota se queda en
  modo solo-slug (sin asunto). El permiso se reverifica en cada run.
- **Dos capas de lectura, ambas de metadatos declarados por el medio:**
  1. **Descubrimiento** — el sitemap declarado da el universo de URLs (loc/lastmod). Se ordena por
     fecha desc y se filtra a señales cívicas geolocalizables.
  2. **Cita** — de las candidatas ya filtradas se lee **solo el `<head>`** (abortando la descarga en
     `</head>`): `og:title` (título real con acentos), `og:description` (**asunto**) y
     `article:published_time` (fecha). **Nunca** se descarga ni se guarda el cuerpo del artículo.
- Cada señal es **periodística** (`confidence: "reported"`), nunca un hecho verificado.
- `imagendeveracruz.mx` sigue **fuera** hasta reverificar su `robots.txt` y tener sitemap/acuerdo
  (`enrichable:false` lo mantendría en solo-slug aunque se agregue).
- El presupuesto de peticiones es acotado y cortés: incremental (reutiliza lo ya enriquecido),
  concurrencia limitada, pausa entre peticiones y tope por run (`SCRAPE_ENRICH_LIMIT`, `=0` desactiva
  la Capa 2).

## Estructura

```
scraping/
└── news/
    ├── news-sources.mjs        ← medios (SOURCES, con `coverage` por municipio y `enrichable`),
    │                             gazetteer de colonias con CP semilla, clasificadores, POSTAL_INDEX,
    │                             helpers por-asentamiento y parseHeadMetadata (título+asunto del <head>)
    ├── robots.mjs              ← parser de robots.txt + checker en tiempo de ejecución (Capa 2)
    ├── scrape-news.mjs         ← scraper offline: descubre por sitemap (orden desc) + enriquece <head>
    ├── enrich-postal-codes.mjs ← añade `postalCode` al snapshot existente sin re-scrapear (offline)
    └── output/
        └── news-signals.generated.json  ← snapshot EFÍMERO que la API lee (`@scraping/...`)
```

## Código postal (esta fase)

Cada colonia del gazetteer lleva un **CP aproximado (semilla)** y cada medio declara la `coverage` de
municipios donde **opera**. De ahí sale `POSTAL_INDEX`: la vista _"señales por código postal donde
operan medios"_. La validación fina CP↔colonia (SEPOMEX / Marco Geoestadístico) es de **OIS**; aquí es
semilla honesta, no domicilio. Cada señal lleva `postalCode` (CP de su colonia, o el CP de respaldo del
municipio si no se resolvió colonia).

## Comandos

```bash
npm run scrape:news      # regenera output/news-signals.generated.json (requiere red; corre en CI/local)
npm run enrich:news-cp   # añade/actualiza postalCode en el snapshot existente (offline, sin red)
```

La API `GET /api/urban/news` lee el snapshot y expone, además de las señales, `byPostalCode`.
