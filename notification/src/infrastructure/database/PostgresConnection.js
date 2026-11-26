const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const initDatabase = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(50) NOT NULL,
      customer_name VARCHAR(100),
      customer_phone VARCHAR(30),
      event_type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'SENT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
  // Idempotencia de los eventos de Kafka: un eventId solo puede generar una notificación.
  // (Un índice único admite varios NULL, así que las notificaciones creadas por HTTP no se ven afectadas.)
  await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id VARCHAR(64)');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_event_id ON notifications (event_id)');
  console.log('✅ Tabla "notifications" verificada/creada en PostgreSQL');
};

module.exports = { pool, initDatabase };