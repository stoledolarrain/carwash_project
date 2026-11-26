-- Se ejecuta automáticamente SOLO la primera vez que arranca el contenedor de PostgreSQL (volumen vacío).
-- Persistencia aislada: cada microservicio tiene su propia base de datos; ninguno lee la de otro.
-- Las tablas las crea cada servicio (migraciones o creación al arrancar).

CREATE DATABASE identity_db;            -- Identity Service
CREATE DATABASE catalog_db;             -- Catalog Service
CREATE DATABASE customer_db;            -- Customer / Vehicle Service
CREATE DATABASE carwash1;               -- Wash Order Service
CREATE DATABASE carwash_payments;       -- Payment Service
CREATE DATABASE carwash_notifications;  -- Notification Service
