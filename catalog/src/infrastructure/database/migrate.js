const fs = require('node:fs');
const path = require('node:path');
const { getPool, verifyDatabaseConnection, closePool, EXPECTED_DATABASE } = require('./pool');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

/**
 * Ejecuta las migraciones SQL pendientes en orden alfabético.
 * Registra cada migración aplicada en `schema_migrations` dentro de una transacción (`BEGIN` / `COMMIT` / `ROLLBACK`),
 * evitando que se apliquen repetidamente y sin eliminar datos existentes.
 *
 * @param {{ pool?: import('pg').Pool, migrationsDir?: string, schema?: string, expectedDatabase?: string | null }} [options]
 * @returns {Promise<{ applied: string[], skipped: string[] }>}
 */
async function runMigrations({
  pool = getPool(),
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  schema = 'public',
  expectedDatabase = EXPECTED_DATABASE
} = {}) {
  if (expectedDatabase) {
    await verifyDatabaseConnection(pool, expectedDatabase);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const client = await pool.connect();
  const applied = [];
  const skipped = [];

  try {
    const quotedSchema = quoteIdentifier(schema);
    if (schema !== 'public') {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`);
    }
    await client.query(`SET search_path TO ${quotedSchema}`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const existingResult = await client.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(existingResult.rows.map((row) => row.filename));

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        skipped.push(file);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return { applied, skipped };
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(({ applied, skipped }) => {
      console.log(
        `Migraciones completadas en ${EXPECTED_DATABASE}. Aplicadas: ${applied.length}, omitidas: ${skipped.length}.`
      );
      return closePool();
    })
    .catch(async (err) => {
      console.error('Error al ejecutar migraciones:', err.message);
      await closePool().catch(() => {});
      process.exit(1);
    });
}

module.exports = { runMigrations };
