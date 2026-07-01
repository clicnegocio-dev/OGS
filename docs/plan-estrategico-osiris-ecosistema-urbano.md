# Plan estrategico: OSIRIS aplicado a Ecosistema Urbano

> 🏛️ **Histórico (banner 2026-06-30).** Documenta el origen técnico de EU (reuso de patrones de
> OSIRIS) y sigue siendo contexto válido. Pero su visión de un backend/OIS propio de EU quedó
> **superada**: el motor (continuidad, memoria, pipeline) lo aporta la plataforma OIS, que es
> agnóstica. La arquitectura vigente: **`spec-integracion-eu-ois_v1.md`**.

Fecha: 2026-06-27

## 1. Lectura del proyecto actual

Ecosistema Urbano ya tiene una propuesta narrativa fuerte: leer la ciudad como un sistema vivo donde movilidad, vivienda, drenaje, comercio, seguridad, confianza institucional, medio ambiente y tecnologia no son piezas aisladas.

El sitio actual en `site/` es una propuesta estatica:

- `site/Ecosistema Urbano.html`: landing principal con hero, mapa estilizado, radar ciudadano, observatorio, red local, OIS/kernel y principios publicos.
- `site/ecosistema.js`: interacciones, tema, deteccion futura de ciudad y mapa SVG generado en cliente.
- `site/reporte-widget.js`: radar ciudadano con reportes semilla y nuevos reportes guardados en `localStorage`, mas envio por WhatsApp.
- `site/radar/*.html`: explicacion del radar, pagina de reporte y red local.
- `site/articulos/*.html`: observatorio editorial inicial.

La tesis actual es correcta para el objetivo: "no es una queja, es una senal". El problema tecnico es que el mapa del hero todavia no es un mapa de datos reales. Es una visualizacion sintetica que comunica la idea, pero no permite tomar decisiones urbanas.

## 2. Lectura de OSIRIS

OSIRIS es una app Next.js/React con MapLibre GL y multiples APIs geoespaciales/OSINT. Su valor para Ecosistema Urbano no esta en copiar toda la interfaz de inteligencia global, sino en reutilizar su avance tecnico:

- Motor de mapa: `maplibre-gl` con render WebGL.
- Componente principal: `src/components/OsirisMap.tsx`.
- Carga progresiva por capas desde `src/app/page.tsx`.
- Panel de capas: `src/components/LayerPanel.tsx`.
- Geolocalizacion por IP: `src/app/api/geo/route.ts`.
- Dossier por coordenada: `src/app/api/region-dossier/route.ts`.
- Fuentes publicas normalizadas: terremotos USGS, clima severo NASA/NOAA, incendios NASA FIRMS/EONET, calidad del aire OpenAQ, CCTV, GDELT, infraestructura, noticias, satelites, etc.
- Estrategia de performance: endpoints con cache, fetch progresivo, conteos agregados y render de miles de entidades via WebGL.

Lo que no conviene trasladar completo:

- El tono de "global intelligence / recon / cyber threat" porque no corresponde al proposito civico urbano.
- Capas de OSINT sensible o ajenas al objetivo de habitabilidad: malware, port scanning, sanciones, crypto tracing, guerra, vigilancia global.
- UI tipo consola militar. Ecosistema Urbano necesita confianza publica, trazabilidad y claridad, no estetica de inteligencia cerrada.

## 3. Objetivo estrategico

Convertir el hero de Ecosistema Urbano en una ventana viva de decision urbana:

> "Antes de decidir vivir, invertir o participar en una ciudad, mira sus senales reales."

La primera version no debe intentar resolver todo. Debe mostrar toda la data disponible que ayude a una persona a evaluar habitabilidad y riesgo de una ciudad, empezando por Boca del Rio / Veracruz y manteniendo el sistema preparado para escalar a otras ciudades.

## 4. Cambio de enfoque del hero

Estado actual:

- Mapa SVG decorativo.
- Ciudad fija: Boca del Rio.
- Tarjetas flotantes ilustrativas.
- Reportes locales simulados/semilla.

Estado propuesto:

- Mapa MapLibre real en el hero.
- Vista inicial centrada en la ciudad detectada o en Boca del Rio como fallback.
- Capas urbanas activables: riesgo ambiental, movilidad, reportes ciudadanos, comercio/servicios, infraestructura, calidad ambiental, seguridad contextual, costo/vida cuando existan datos.
- Tarjetas encima del mapa con metricas honestas: fuente, fecha, cobertura y limitaciones.
- CTA principal: "Explorar senales de mi ciudad".
- CTA secundario: "Reportar una senal".

## 5. Capas de datos prioritarias para decidir vivir en una ciudad

### Fase 1: datos disponibles rapido

Estas capas se pueden construir con el avance tecnico de OSIRIS y fuentes publicas/keyless:

- Ubicacion y contexto: geolocalizacion por IP, reverse geocoding, ciudad/estado/pais.
- Riesgo sismico: USGS earthquakes.
- Clima severo: NASA EONET y NOAA/NWS donde aplique.
- Incendios/calor extremo: NASA FIRMS/EONET.
- Calidad del aire: OpenAQ si hay cobertura.
- Dossier territorial: Nominatim, RestCountries, Wikipedia/Wikidata, adaptado de pais a ciudad.
- Reportes ciudadanos: reemplazar `localStorage` por una fuente JSON/API propia.
- Camaras publicas solo si tienen valor civico y legal claro; no como vigilancia, sino como "estado visible de puntos publicos".

### Fase 2: datos urbanos locales

Estas capas son mas valiosas para habitabilidad, pero requieren integracion local:

- Inundaciones historicas y zonas bajas.
- Drenaje, obras y reportes de mantenimiento.
- Banquetas, accesibilidad y seguridad peatonal.
- Transporte publico, tiempos de traslado y cobertura.
- Escuelas, hospitales, mercados, parques y servicios esenciales.
- Ruido, calor urbano, arbolado y sombra.
- Delitos agregados por zona, sin exponer personas ni fomentar linchamientos.
- Precio de vivienda/renta y relacion con ingreso local.
- Cierres/aperturas de negocios como senal economica.

### Fase 3: indice de decision urbana

Una vez existan suficientes capas, crear un indice explicable:

- Seguridad cotidiana.
- Riesgo ambiental.
- Movilidad real.
- Servicios basicos.
- Acceso economico.
- Vitalidad comercial.
- Confianza institucional.
- Calidad del espacio publico.

El indice no debe ser una calificacion opaca. Debe mostrar evidencia, fecha, fuente y peso de cada capa.

## 6. Arquitectura recomendada

### Opcion recomendada: evolucionar a app Next.js

OSIRIS ya esta construido en Next.js. Para aprovecharlo bien, Ecosistema Urbano deberia moverse gradualmente de HTML estatico a una app Next:

- `app/page.tsx`: landing con hero MapLibre.
- `components/UrbanMap.tsx`: version curada de `OsirisMap`.
- `components/UrbanLayerPanel.tsx`: capas civicas, no OSINT militar.
- `app/api/urban/geo/route.ts`: geolocalizacion.
- `app/api/urban/signals/route.ts`: reportes ciudadanos.
- `app/api/urban/hazards/route.ts`: clima, sismo, fuego, calidad del aire.
- `app/api/urban/profile/route.ts`: perfil socioeconomico oficial (DataMexico; sustituyo al dossier Wikipedia, ya retirado).
- `public/data/urban/*.json`: datasets iniciales versionados para Boca del Rio.

Ventajas:

- Reutiliza directamente componentes y patrones de OSIRIS.
- Permite API routes, cache, SSR/edge y crecimiento ordenado.
- Evita meter MapLibre complejo dentro de un HTML estatico.

Riesgo:

- Requiere migracion de sitio y build/deploy.

### Opcion puente: micro-widget MapLibre dentro del HTML actual

Si se necesita una demo rapida:

- Mantener `site/Ecosistema Urbano.html`.
- Agregar MapLibre via CDN.
- Sustituir `#city-map` por un contenedor `div`.
- Crear `site/urban-map.js`.
- Leer datos desde `site/data/*.geojson`.

Ventajas:

- Demo rapida.
- Menos reestructura.

Riesgo:

- Se vuelve dificil mantener APIs, caching, datasets y capas complejas.
- Termina siendo una deuda tecnica si el proyecto crece.

Recomendacion pragmatica: hacer un prototipo puente solo si se necesita vender/mostrar en dias. Para producto real, migrar a Next.

## 7. Adaptacion tecnica concreta desde OSIRIS

Tomar de OSIRIS:

- Inicializacion MapLibre.
- Transformacion de arreglos a GeoJSON sources.
- Capas `circle`, `symbol`, `line`, `fill`, `heatmap`.
- Visibilidad por capa.
- `flyToLocation`.
- Geolocalizacion por IP con fallback de proveedores.
- Dossier por coordenada.
- Carga progresiva por capas.
- Cache headers en rutas API.
- Conteos agregados.

Modificar:

- Centro inicial: Boca del Rio / Veracruz o ciudad detectada.
- Estilo visual: del dark intelligence dashboard a la identidad clara de Ecosistema Urbano.
- Capas: de "threat/intel" a "habitabilidad/senales urbanas".
- Popups: de entidad OSINT a explicacion civica: que es, fuente, fecha, por que importa, que decision informa.
- Paneles: de consola a lectura publica: "Riesgos", "Vida diaria", "Servicios", "Economia local", "Reportes".

Descartar:

- Recon toolkit.
- Malware/cyber/crypto/sanctions.
- Conflictos militares globales salvo contexto de seguridad pais, no hero urbano.
- UI de vigilancia agresiva.

## 8. MVP propuesto

### MVP 1: Hero vivo con datos reales

Entregable:

- Hero con MapLibre.
- Centro en Boca del Rio.
- 5 capas iniciales:
  - Reportes ciudadanos.
  - Riesgo hidrico/inundacion inicial desde dataset local.
  - Clima severo/fuego/sismo desde fuentes publicas.
  - Calidad ambiental si OpenAQ tiene cobertura.
  - Servicios/zonas clave desde dataset local curado.
- Tarjetas de resumen:
  - "Senales activas".
  - "Riesgo ambiental".
  - "Cobertura de datos".
  - "Ultima actualizacion".
- Popup por punto/zona con fuente y explicacion.

### MVP 2: Ciudad comparable

Entregable:

- Selector de ciudad.
- Dossier urbano.
- Comparacion entre zonas.
- Primer indice de habitabilidad explicable.

### MVP 3: OIS urbano operativo

Entregable:

- Backend persistente para reportes.
- Flujo de verificacion.
- Panel editorial para publicar analisis.
- API publica de senales agregadas.
- Exportacion de datos anonimizados.

## 9. Modelo de datos minimo

Cada senal urbana debe normalizarse asi:

```json
{
  "id": "signal_001",
  "city": "Boca del Rio",
  "layer": "ambiental",
  "type": "inundacion",
  "title": "Encharcamiento recurrente",
  "description": "La zona presenta reportes recurrentes de acumulacion de agua.",
  "lat": 19.104,
  "lng": -96.104,
  "severity": "medium",
  "confidence": "reported",
  "source": "Radar ciudadano",
  "source_url": null,
  "observed_at": "2026-06-27",
  "updated_at": "2026-06-27",
  "privacy": "aggregated"
}
```

Campos obligatorios:

- `source`
- `observed_at` o `updated_at`
- `confidence`
- `privacy`
- `layer`
- `type`
- `lat/lng` o geometria

Sin esto, el mapa se vuelve estetica sin trazabilidad.

## 10. Principios de gobernanza

Para que el mapa sirva a decisiones reales:

- Distinguir reporte, dato oficial, inferencia y analisis.
- Mostrar fuente y fecha siempre.
- No publicar datos personales sensibles.
- Agregar o difuminar reportes cuando puedan identificar hogares/personas.
- No convertir zonas vulnerables en estigma inmobiliario.
- Explicar incertidumbre: "sin datos" no significa "sin problema".
- Mantener bitacora de cambios de datasets.

## 11. Roadmap operativo

### Semana 1

- Definir si el producto migra a Next o si se hace widget puente.
- Crear inventario de fuentes para Boca del Rio.
- Crear dataset semilla `signals.geojson`.
- Prototipar MapLibre en hero.

### Semana 2

- Portar patrones de OSIRIS a `UrbanMap`.
- Conectar capas de reportes y riesgos.
- Crear popups con fuente/fecha/confianza.
- Ajustar identidad visual para que no parezca dashboard militar.

### Semana 3

- Crear endpoint de dossier urbano.
- Crear conteos agregados.
- Crear selector basico de capas.
- Revisar performance mobile.

### Semana 4

- Publicar demo.
- Validar con usuarios: familias, comercios, colectivos, municipio/universidad.
- Ajustar capas segun utilidad real para decidir vivir/invertir.

## 12. Decision recomendada

Proceder con una migracion controlada a Next.js usando OSIRIS como base tecnica, pero no como base narrativa ni visual.

El hero debe evolucionar de "mapa bonito de una ciudad" a "mapa vivo de evidencia urbana". La primera promesa publica no debe ser "tenemos todos los datos", sino:

> "Mostramos que datos existen, de donde vienen, que tan confiables son y que todavia falta medir."

Esa honestidad es lo que puede convertir Ecosistema Urbano en una herramienta seria de decision y no en otro tablero decorativo.
