-- Migración 001: Tablas wash_services y outbox_events de Catalog Service

CREATE TABLE IF NOT EXISTS wash_services (
  id                 UUID PRIMARY KEY,
  name               VARCHAR(100) NOT NULL,
  description        VARCHAR(500) NOT NULL DEFAULT '',
  price              NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency           CHAR(3) NOT NULL DEFAULT 'BOB' CHECK (currency = 'BOB'),
  estimated_duration INTEGER NOT NULL CHECK (estimated_duration > 0),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wash_services_name_lower
  ON wash_services (LOWER(name));

CREATE INDEX IF NOT EXISTS ix_wash_services_is_active
  ON wash_services (is_active);

CREATE TABLE IF NOT EXISTS outbox_events (
  id           UUID PRIMARY KEY,
  event_name   VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  topic        VARCHAR(100) NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error   TEXT NULL
);

CREATE INDEX IF NOT EXISTS ix_outbox_events_pending
  ON outbox_events (created_at)
  WHERE published_at IS NULL;
