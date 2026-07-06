-- ⚠️ SUPERADO (2026-07-06) — NO DESPLEGAR. Documento HISTÓRICO conservado como referencia.
-- Ecosistema Urbano NO construye backend/DB propios: la persistencia (ingestión, boundaries oficiales,
-- reportes, memoria) es trabajo de OIS. Regla de oro y contrato vigente: docs/spec-integracion-eu-ois_v1.md
-- (§0.2, §2 "lo que EU DEJA de construir"). En el código: `grep DATABASE_URL src/` → 0 usos; el mapa se
-- sirve del snapshot de scraping y de las APIs oficiales en vivo, sin Postgres. Este esquema (y el de
-- spec-arquitectura-ois.md §5) quedan como bocetos del motor que hoy vive en OIS.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS settlements (
  id text PRIMARY KEY,
  name text NOT NULL,
  state_name text NOT NULL,
  country text NOT NULL DEFAULT 'Mexico',
  inegi_entity_code text,
  inegi_municipality_code text,
  inegi_area_code text,
  center geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL,
  base_url text,
  license text,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS denue_businesses (
  id text PRIMARY KEY,
  settlement_id text NOT NULL REFERENCES settlements(id),
  clee text,
  name text NOT NULL,
  business_name text,
  activity text,
  sector_id text,
  subsector_id text,
  branch_id text,
  class_id text,
  size text,
  neighborhood text,
  postal_code text,
  location_text text,
  phone text,
  email text,
  website text,
  establishment_type text,
  geom geography(Point, 4326) NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_id text NOT NULL REFERENCES data_sources(id),
  observed_at date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS denue_businesses_geom_idx ON denue_businesses USING gist (geom);
CREATE INDEX IF NOT EXISTS denue_businesses_settlement_idx ON denue_businesses (settlement_id);
CREATE INDEX IF NOT EXISTS denue_businesses_sector_idx ON denue_businesses (sector_id, subsector_id, class_id);

CREATE TABLE IF NOT EXISTS urban_boundaries (
  id bigserial PRIMARY KEY,
  settlement_id text NOT NULL REFERENCES settlements(id),
  boundary_kind text NOT NULL,
  precision text NOT NULL,
  method text NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  source_id text NOT NULL REFERENCES data_sources(id),
  complete boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS urban_boundaries_geom_idx ON urban_boundaries USING gist (geom);
CREATE INDEX IF NOT EXISTS urban_boundaries_lookup_idx ON urban_boundaries (settlement_id, boundary_kind, precision);

CREATE TABLE IF NOT EXISTS urban_signals (
  id text PRIMARY KEY,
  settlement_id text NOT NULL REFERENCES settlements(id),
  layer text NOT NULL,
  signal_type text NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL,
  confidence text NOT NULL,
  privacy text NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  source_id text NOT NULL REFERENCES data_sources(id),
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS urban_signals_geom_idx ON urban_signals USING gist (geom);
CREATE INDEX IF NOT EXISTS urban_signals_settlement_layer_idx ON urban_signals (settlement_id, layer);
