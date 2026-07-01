# `scraping/` — fuentes por scraping (plano de LECTURA, **efímero**)

Carpeta dedicada para todo el **scraping** de Ecosistema Urbano. Es el **plano de lectura**: datos que
EU *consulta* de la ciudad (medios, etc.), que viven de forma **efímera** en EU y se pintan en el mapa.
**No viajan a OIS.** La ingestión *persistente* de estas señales (y su conversión en memoria/patrones)
es trabajo de **OIS en Fase 2** — ver `docs/spec-integracion-eu-ois_v1.md`. Aquí solo materializamos un
snapshot que la API *solo lee*; nada de scraping en request-time.

## Cumplimiento

- Se respeta `robots.txt` y los términos de cada sitio. Solo se consume lo que el medio **declara**
  (sitemaps): título (derivado del slug), URL, fecha y sección. **Nunca** se descarga el cuerpo del
  artículo; se guarda extracto + enlace.
- Cada señal es **periodística** (`confidence: "reported"`), nunca un hecho verificado.
- `imagendeveracruz.mx` queda **fuera** (su `robots.txt` prohíbe bots y no publica sitemap).

## Estructura

```
scraping/
└── news/
    ├── news-sources.mjs        ← medios (SOURCES, con `coverage` por municipio), gazetteer de
    │                             colonias con CP semilla, clasificadores, y POSTAL_INDEX (CP↔medios)
    ├── scrape-news.mjs         ← scraper offline (lee sitemap XEU → señales con colonia + código postal)
    ├── enrich-postal-codes.mjs ← añade `postalCode` al snapshot existente sin re-scrapear (offline)
    └── output/
        └── news-signals.generated.json  ← snapshot EFÍMERO que la API lee (`@scraping/...`)
```

## Código postal (esta fase)

Cada colonia del gazetteer lleva un **CP aproximado (semilla)** y cada medio declara la `coverage` de
municipios donde **opera**. De ahí sale `POSTAL_INDEX`: la vista *"señales por código postal donde
operan medios"*. La validación fina CP↔colonia (SEPOMEX / Marco Geoestadístico) es de **OIS**; aquí es
semilla honesta, no domicilio. Cada señal lleva `postalCode` (CP de su colonia, o el CP de respaldo del
municipio si no se resolvió colonia).

## Comandos

```bash
npm run scrape:news      # regenera output/news-signals.generated.json (requiere red; corre en CI/local)
npm run enrich:news-cp   # añade/actualiza postalCode en el snapshot existente (offline, sin red)
```

La API `GET /api/urban/news` lee el snapshot y expone, además de las señales, `byPostalCode`.
