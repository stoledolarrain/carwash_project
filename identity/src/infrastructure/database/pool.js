const { Pool } = require('pg');

/** Identity solo debe conectarse a su propia base: evita escribir por error en la de otro microservicio. */
const EXPECTED_DATABASE = 'identity_db';
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function extractDatabaseName(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    throw new Error('DATABASE_URL es obligatorio para conectarse a PostgreSQL.');
  }
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(
      'DATABASE_URL no es una URL válida. Si la contraseña tiene caracteres como @ # / :, escríbalos codificados (por ejemplo @ como %40).'
    );
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

/**
 * Crea un pool de conexiones. Con `schema` fija el `search_path` (lo usan las pruebas para trabajar
 * en un schema temporal sin tocar `public`).
 */
function createPool({ connectionString, max = 10, idleTimeoutMillis = 30000, schema = null }) {
  extractDatabaseName(connectionString);

  const poolConfig = { connectionString, max, idleTimeoutMillis };
  if (schema) {
    if (!IDENTIFIER_PATTERN.test(schema)) {
      throw new Error(`Identificador de schema inválido: ${schema}`);
    }
    poolConfig.options = `-c search_path=${schema}`;
  }

  const pool = new Pool(poolConfig);
  pool.on('error', (err) => {
    console.error('[PostgreSQL] Error en un cliente inactivo del pool:', err.message);
  });
  return pool;
}

/** Comprueba la conexión y que la base conectada sea la esperada. */
async function verifyDatabaseConnection(pool, expectedDatabase = EXPECTED_DATABASE) {
  const result = await pool.query('SELECT current_database() AS database_name');
  const currentDatabase = result.rows[0]?.database_name;
  if (expectedDatabase && currentDatabase !== expectedDatabase) {
    throw new Error(`Conectado a la base "${currentDatabase}", pero se esperaba "${expectedDatabase}".`);
  }
  return currentDatabase;
}

module.exports = { EXPECTED_DATABASE, IDENTIFIER_PATTERN, extractDatabaseName, createPool, verifyDatabaseConnection };
