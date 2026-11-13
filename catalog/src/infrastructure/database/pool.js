const { Pool } = require('pg');
const { config: defaultConfig } = require('../../config/env');

const EXPECTED_DATABASE = 'catalog_db';

let sharedPool = null;
let sharedConnectionString = null;

function extractDatabaseName(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
  }
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL.');
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

/**
 * Crea un Pool de PostgreSQL configurado desde `DATABASE_URL`.
 * No almacena credenciales en el código y registra errores de clientes inactivos.
 */
function createPool({
  connectionString = defaultConfig.databaseUrl,
  max = 10,
  idleTimeoutMillis = 30000,
  schema = null
} = {}) {
  extractDatabaseName(connectionString);

  const poolConfig = {
    connectionString,
    max,
    idleTimeoutMillis
  };

  if (schema) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      throw new Error(`Invalid SQL schema identifier: ${schema}`);
    }
    poolConfig.options = `-c search_path=${schema}`;
  }

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.message);
  });

  return pool;
}

/**
 * Devuelve la instancia compartida del Pool (patrón Singleton a nivel de módulo/proceso)
 * para evitar abrir múltiples pools innecesarios hacia la misma base de datos.
 */
function getPool(options = {}) {
  const connectionString = options.connectionString || defaultConfig.databaseUrl;
  if (!sharedPool || sharedConnectionString !== connectionString) {
    sharedPool = createPool({ ...options, connectionString });
    sharedConnectionString = connectionString;
  }
  return sharedPool;
}

/**
 * Verifica la conectividad con PostgreSQL y que la base de datos conectada sea la esperada
 * (`catalog_db` por defecto). Lanza un error descriptivo si no coincide o no hay conexión.
 */
async function verifyDatabaseConnection(pool = getPool(), expectedDatabase = EXPECTED_DATABASE) {
  const result = await pool.query('SELECT current_database() AS database_name');
  const currentDatabase = result.rows[0]?.database_name;

  if (expectedDatabase && currentDatabase !== expectedDatabase) {
    throw new Error(
      `Connected to unexpected database "${currentDatabase}". Expected "${expectedDatabase}".`
    );
  }

  return currentDatabase;
}

/** Cierra el pool compartido o el pool recibido por parámetro. */
async function closePool(pool = sharedPool) {
  if (!pool) return;
  if (pool === sharedPool) {
    sharedPool = null;
    sharedConnectionString = null;
  }
  await pool.end();
}

module.exports = {
  EXPECTED_DATABASE,
  extractDatabaseName,
  createPool,
  getPool,
  verifyDatabaseConnection,
  closePool
};
