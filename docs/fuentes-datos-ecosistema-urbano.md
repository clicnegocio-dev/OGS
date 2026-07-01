# Fuentes de datos para Ecosistema Urbano

Fecha: 2026-06-27

## Comprension operativa

Ecosistema Urbano no es un tablero de datos por acumulacion. Es un sistema para leer una ciudad como red de senales: vivir, invertir o participar en una zona depende de capas conectadas como economia local, movilidad, infraestructura, ambiente, seguridad, servicios, confianza institucional y actividad social.

La regla para integrar fuentes es:

- Cada dato debe tener fuente, fecha, cobertura, licencia o condicion de uso.
- Se debe distinguir dato oficial, reporte ciudadano, medio periodistico e inferencia.
- El mapa debe mostrar evidencia accionable, no ruido.
- Una capa sin trazabilidad no entra al mapa operativo.

## Fase 1: fuentes oficiales con API o acceso estructurado

### INEGI DENUE

- Uso: establecimientos, actividad economica, servicios, vitalidad comercial, equipamiento.
- Acceso: API oficial con token.
- Cobertura: nacional, georreferenciada.
- Integracion inicial: implementada en `/api/urban/denue`.
- Capa sugerida: `economico`, con reclasificacion parcial hacia `social` e `institucional`.
- Fuente: https://www.inegi.org.mx/servicios/api_denue.html

### INEGI Banco de Indicadores

- Uso: indicadores por entidad/municipio para poblacion, vivienda, economia, educacion, empleo.
- Acceso: API oficial.
- Capa sugerida: dossier de ciudad y metricas agregadas, no puntos.
- Fuente: https://www.inegi.org.mx/servicios/api_indicadores.html

### INEGI Espacio y Datos de Mexico / Entorno urbano

- Uso: banqueta, alumbrado, arboles, rampas, paso peatonal, drenaje pluvial, transporte colectivo.
- Acceso: sistema web de consulta; requiere investigar endpoints internos o descarga disponible.
- Capa sugerida: `urbano`, `social`, `ambiental`.
- Fuente: https://www.inegi.org.mx/app/mapa/espacioydatos/default.aspx

### INEGI Marco Geoestadistico

- Uso: limites de entidad, municipio, localidad, AGEB y manzana.
- Acceso: descargas oficiales.
- Capa sugerida: geometria base para agregacion territorial.
- Fuente: https://www.inegi.org.mx/temas/mg/

### CONAGUA / SMN

- Uso: estaciones climatologicas, lluvia, temperatura, hidrometria, eventos extremos.
- Acceso: paginas oficiales, datos.gob.mx y descargas.
- Capa sugerida: `ambiental` y `riesgo`.
- Fuentes:
  - https://smn.conagua.gob.mx/es/climatologia/informacion-climatologica/informacion-estadistica-climatologica
  - https://www.datos.gob.mx/dataset/estaciones_sistema_informacion_hidrologica

### datos.gob.mx

- Uso: catalogo nacional para datasets federales, estatales y municipales.
- Acceso: portal de datasets; requiere exploracion por tema y dependencia.
- Capa sugerida: segun dataset.
- Fuente: https://www.datos.gob.mx/

### Portal municipal de datos abiertos de Veracruz

- Uso: datasets municipales potencialmente utiles para servicios, infraestructura, tramites, seguridad, obras.
- Acceso: portal CKAN. Se puede consultar con Action API (`/api/3/action/package_search`, `package_show`, recursos CSV/XLSX/TXT).
- Capa sugerida: `institucional`, `urbano`, `economico`.
- Fuente: https://datos.veracruzmunicipio.gob.mx/
- Hallazgos iniciales:
  - 379 conjuntos de datos disponibles en el portal.
  - Universidades de Veracruz 2023/2024 con recursos CSV/XLSX/TXT.
  - Cedulas de empadronamiento/licencias 2023 en CSV.
  - Restaurantes en Veracruz 2024 en TXT.
  - Padron de proveedores y contratistas en CSV/XLSX/TXT.
- Prioridad: construir un conector CKAN para listar datasets, seleccionar recursos tabulares y normalizar si contienen direccion, colonia o coordenadas.

### Gobierno del Estado de Veracruz - datos abiertos

- Estado encontrado: pagina institucional indica apartado en elaboracion/aprobacion.
- Uso: monitorear, pero no depender de esta fuente como primera integracion.
- Fuente: https://www.veracruz.gob.mx/participacion/datos-abiertos/

### Obra Publica Abierta / Transparencia Presupuestaria

- Uso: obras federales, proyectos, ubicacion y presupuesto.
- Acceso: portal con mapa y bases abiertas.
- Capa sugerida: `institucional` y `urbano`.
- Fuente: https://www.transparenciapresupuestaria.gob.mx/Obra-Publica-Abierta

## Fase 2: fuentes por scraping controlado

### Medios locales

Objetivo: detectar senales urbanas por asentamiento, colonia o zona. No sustituye datos oficiales; sirve como capa de alerta y narrativa territorial.

Fuentes iniciales:

- Imagen de Veracruz: https://imagendeveracruz.mx
- XEU Noticias: https://xeu.mx/

Hallazgos iniciales:

- XEU tiene paginas por temas y noticias locales con titulos detectables desde HTML; se debe revisar si ofrece RSS/sitemap antes de scrapear listados.
- Imagen de Veracruz publica notas con fecha, autor/seccion y URLs estables; se debe preferir sitemap/RSS si existen.
- Ambos medios pueden aportar senales por asentamiento cuando mencionan colonias, fraccionamientos, municipios, obras, trafico, inundaciones, accidentes o servicios.

Campos a extraer:

- titulo
- fecha
- url
- medio
- categoria/seccion
- texto breve
- asentamientos detectados
- municipio detectado
- coordenada aproximada si se puede geocodificar
- tipo de senal: inundacion, accidente, obra, inseguridad, comercio, movilidad, servicios, clima, gobierno
- confianza: `media_report`

Reglas:

- Respetar robots.txt y terminos.
- Preferir RSS/sitemaps si existen.
- No copiar articulos completos; almacenar extractos y enlaces.
- Clasificar como senal periodistica, no como hecho verificado.

## Prioridad tecnica inmediata

1. DENUE funcional como primera capa oficial.
2. Conector CKAN para inventario de endpoints/datasets del portal municipal de Veracruz.
3. INEGI Banco de Indicadores para dossier municipal.
4. Entorno urbano INEGI para infraestructura peatonal y servicios urbanos.
5. Scraper de medios locales con clasificacion por asentamiento.

## Delimitacion territorial

Para mostrar "toda la data del asentamiento" no se debe usar un radio. El flujo correcto es:

1. Resolver el asentamiento a una clave territorial estable.
2. Obtener o consultar su poligono.
3. Filtrar datos por interseccion espacial (`ST_Intersects`) o por clave geoestadistica cuando la fuente lo permita.
4. Cachear el resultado materializado.

### Boca del Rio

- Clave estatal INEGI: `30`.
- Clave municipal INEGI: `028`.
- Clave de area geoestadistica municipal: `30028`.
- DENUE puede consultarse por municipio completo con `BuscarAreaAct/30/028/...`, evitando radio.

### MVP actual

- `/api/urban/boundary?settlement=boca-del-rio&method=denue` entrega un poligono derivado de puntos oficiales DENUE.
- `/api/urban/denue?settlement=boca-del-rio&mode=area` pagina DENUE por municipio completo.
- El metodo actual usa: puntos DENUE del municipio -> recorte de outliers p1/p99 -> convex hull -> padding minimo.
- Esta geometria representa la huella economica/urbana observada por establecimientos, no el limite juridico perfecto.
- El poligono oficial final debe venir de Marco Geoestadistico INEGI cargado en PostGIS.

### Preparacion PostGIS

Tabla sugerida:

```sql
create table urban_boundaries (
  id text primary key,
  name text not null,
  country text not null,
  state_name text,
  inegi_entity_code text,
  inegi_municipality_code text,
  inegi_area_code text,
  boundary_level text not null,
  source text not null,
  source_version text,
  geom geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz default now()
);

create index urban_boundaries_geom_idx
  on urban_boundaries
  using gist (geom);
```

Consulta futura para datos ya filtrados:

```sql
select s.*
from urban_signals s
join urban_boundaries b on b.id = $1
where st_intersects(s.geom, b.geom);
```

El contrato de API ya esta pensado para sustituir el poligono semilla por:

```sql
select id, name, st_asgeojson(geom)::json as geometry
from urban_boundaries
where id = $1;
```
