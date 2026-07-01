# Ecosistema Urbano

Piel cívica de mapa y tablero de señales urbanas por asentamiento, con datos oficiales abiertos. **Software libre (AGPL-3.0).** La plataforma que aporta memoria/continuidad y opera la captura ciudadana es **OIS** (programa separado) — ver `docs/spec-integracion-eu-ois_v1.md`.

## Desarrollo

```bash
npm install
npm run dev -- -p 3001
```

Rutas principales:

- `http://localhost:3001/boca-del-rio`
- `http://localhost:3001/veracruz`

## Variables

Copiar `.env.example` a `.env.local` y configurar:

- `DENUE_TOKEN`: token de INEGI DENUE.
- `DATABASE_URL`: **(no usado aún)** conexión futura a Postgres/PostGIS. Hoy es aspiracional; el MVP no toca DB.
- `ML_ACCESS_TOKEN` *(opcional)*: token de 6 h de la API oficial de Mercado Libre para el dato inmobiliario (`/api/urban/market`). Para pruebas locales.
- `ML_CLIENT_ID` / `ML_CLIENT_SECRET` / `ML_REFRESH_TOKEN` *(opcional, producción)*: mintea el access token vía refresh. Ojo: el `refresh_token` de ML rota en cada uso (persistirlo es trabajo de OIS). Sin credenciales, `/api/urban/market` degrada a `configured:false` (no rompe).

## Scripts

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
npm run scrape:news  # regenera scraping/news/output/news-signals.generated.json (scraper OFFLINE del sitemap de XEU)
```

## Validación

Con el servidor corriendo (`npm run dev -- -p 3001`):

```bash
npm run verify:api   # smoke test del contrato de las APIs (requiere el server vivo)
```

## Datos

El endpoint `/api/urban/denue` entrega por defecto payload ligero para mapa:

```text
/api/urban/denue?settlement=boca-del-rio&mode=area&condition=todos&detail=map
```

Para inspección completa:

```text
/api/urban/denue?settlement=boca-del-rio&mode=area&condition=todos&detail=full
```

## PostGIS

El esquema inicial está en `docs/postgis-schema.sql`. La ruta esperada es:

1. Ingestar DENUE por asentamiento.
2. Guardar boundaries oficiales y derivados.
3. Servir el mapa por `settlement`, `viewport`, `zoom` y `layer`.
4. Cargar detalle completo bajo demanda por entidad.

## Licencia

Copyright © 2026 ClicNegocio · Ecosistema Urbano. *(Ajustar la entidad legal titular si procede.)*

Ecosistema Urbano es **software libre** bajo **GNU AGPL-3.0-or-later** (texto completo en `LICENSE`).
Es la piel cívica abierta, **forkeable y auto-hospedable** — coherente con el principio de código
abierto y soberanía tecnológica: *la rendición de cuentas pública no debe depender de cajas negras
privadas.* AGPL cubre el uso en red: quien opere una versión modificada como servicio debe ofrecer su
código fuente. **OIS**, la plataforma que la opera (memoria/continuidad), es un **programa separado**
que se comunica por una frontera HTTP; su licencia es independiente.
