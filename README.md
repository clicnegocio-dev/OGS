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
- `ML_ACCESS_TOKEN` _(opcional)_: token de 6 h de la API oficial de Mercado Libre para el dato inmobiliario (`/api/urban/market`). Para pruebas locales.
- `ML_CLIENT_ID` / `ML_CLIENT_SECRET` / `ML_REFRESH_TOKEN` _(opcional, producción)_: mintea el access token vía refresh. Ojo: el `refresh_token` de ML rota en cada uso (persistirlo es trabajo de OIS). Sin credenciales, `/api/urban/market` degrada a `configured:false` (no rompe).

## Scripts

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
npm run scrape:news  # regenera scraping/news/output/news-signals.generated.json (scraper OFFLINE multi-medio: XEU, Plumas Libres, El Dictamen)
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

## Persistencia (es de OIS, no de EU)

Ecosistema Urbano **no construye backend ni base de datos propios**. La ingestión persistente, los
boundaries oficiales, los reportes y la memoria de patrones son trabajo de **OIS**; EU es la piel
cívica que _lee_ fuentes oficiales en vivo y sirve un snapshot de scraping. Contrato vigente:
`docs/spec-integracion-eu-ois_v1.md` (regla de oro: EU no duplica OIS). El `docs/postgis-schema.sql`
queda como **boceto histórico SUPERADO** (no desplegar) del motor que hoy vive en OIS.

## Licencia

Copyright © 2026 ClicNegocio · Ecosistema Urbano. _(Ajustar la entidad legal titular si procede.)_

Ecosistema Urbano es **software libre** bajo **GNU AGPL-3.0-or-later** (texto completo en `LICENSE`).
Es la piel cívica abierta, **forkeable y auto-hospedable** — coherente con el principio de código
abierto y soberanía tecnológica: _la rendición de cuentas pública no debe depender de cajas negras
privadas._ AGPL cubre el uso en red: quien opere una versión modificada como servicio debe ofrecer su
código fuente. **OIS**, la plataforma que la opera (memoria/continuidad), es un **programa separado**
que se comunica por una frontera HTTP; su licencia es independiente.
