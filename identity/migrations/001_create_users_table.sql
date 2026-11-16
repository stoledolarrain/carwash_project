-- Identity Service: tabla de usuarios del personal.
-- Base de datos propia del servicio: identity_db. Ningún otro microservicio debe leerla directamente.

CREATE TABLE IF NOT EXISTS users (
  id             UUID         PRIMARY KEY,
  email          VARCHAR(254) NOT NULL,
  full_name      VARCHAR(100) NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(20)  NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  token_version  INTEGER      NOT NULL DEFAULT 0,
  version        INTEGER      NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ  NOT NULL,
  updated_at     TIMESTAMPTZ  NOT NULL,
  last_login_at  TIMESTAMPTZ  NULL,

  CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'RECEPTIONIST', 'WASHER')),
  CONSTRAINT chk_users_email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT chk_users_full_name_length CHECK (CHAR_LENGTH(full_name) >= 3),
  CONSTRAINT chk_users_token_version CHECK (token_version >= 0),
  CONSTRAINT chk_users_version CHECK (version >= 1)
);

-- Correo único. El dominio ya lo normaliza a minúsculas; el CHECK de arriba lo garantiza también en la base.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);

-- Consultas frecuentes: personal activo por rol (p. ej. lavadores disponibles) y conteo de administradores activos.
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, is_active);
