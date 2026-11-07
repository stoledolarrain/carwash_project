const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const rutaBaseDatos = path.join(__dirname, 'wash_orders.sqlite');
const baseDatos = new DatabaseSync(rutaBaseDatos);

baseDatos.exec(`
  CREATE TABLE IF NOT EXISTS wash_orders (
    id TEXT PRIMARY KEY,
    placa_vehiculo TEXT NOT NULL,
    cliente_id TEXT,
    servicios TEXT NOT NULL,
    precio_total REAL NOT NULL DEFAULT 0,
    responsable_id TEXT,
    estado TEXT NOT NULL,
    fecha_creacion TEXT NOT NULL,
    fecha_entrega TEXT
  )
`);

// Migración segura para bases de datos creadas con versiones previas del esquema
const columnasExistentes = baseDatos
  .prepare('PRAGMA table_info(wash_orders)')
  .all()
  .map((col) => col.name);

if (!columnasExistentes.includes('cliente_id')) {
  baseDatos.exec('ALTER TABLE wash_orders ADD COLUMN cliente_id TEXT');
}

if (!columnasExistentes.includes('precio_total')) {
  baseDatos.exec('ALTER TABLE wash_orders ADD COLUMN precio_total REAL NOT NULL DEFAULT 0');
}

if (!columnasExistentes.includes('fecha_entrega')) {
  baseDatos.exec('ALTER TABLE wash_orders ADD COLUMN fecha_entrega TEXT');
}

module.exports = baseDatos;
