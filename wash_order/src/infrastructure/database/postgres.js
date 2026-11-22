const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'carwash1'
});

let tablaInicializada = false;

async function inicializarBaseDatos() {
  if (tablaInicializada) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wash_orders (
      id VARCHAR(50) PRIMARY KEY,
      placa_vehiculo VARCHAR(20) NOT NULL,
      cliente_id VARCHAR(50),
      servicios JSONB NOT NULL,
      precio_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
      responsable_id VARCHAR(50),
      estado VARCHAR(20) NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL,
      fecha_entrega TIMESTAMPTZ
    )
  `);

  await pool.query(`ALTER TABLE wash_orders ADD COLUMN IF NOT EXISTS cliente_id VARCHAR(50)`);
  await pool.query(`ALTER TABLE wash_orders ADD COLUMN IF NOT EXISTS precio_total NUMERIC(10, 2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE wash_orders ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ`);

  // Normalizar registros antiguos de prueba cuyo cliente_id no tenía formato UUID
  await pool.query(`
    UPDATE wash_orders
    SET cliente_id = NULL
    WHERE cliente_id IS NOT NULL
      AND cliente_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  `);

  tablaInicializada = true;
}

module.exports = {
  pool,
  inicializarBaseDatos
};
