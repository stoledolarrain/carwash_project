const fs = require('node:fs');
const path = require('node:path');
const { EXPECTED_DATABASE, IDENTIFIER_PATTERN, createPool, verifyDatabaseConnection } = require('./pool');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

/**
 * Aplica en orden alfabético los archivos `migrations/*.sql` que aún no se aplicaron.
 * Cada migración corre en su propia transacción y queda registrada en `schema_migrations`,
 * así que ejecutar esto varias veces es seguro (idempotente) y nunca borra datos.
 *
 * @returns {Promise<{ applied: string[], skipped: string[] }>}
 */
async function runMigrations({
  pool,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  schema = 'public',
  expectedDatabase = EXPECTED_DATABASE
}) {
  if (!IDENTIFIER_PATTERN.test(schema)) {
    throw new Error(`Identificador de schema inválido: ${schema}`);
  }
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
    if (schema !== 'public') {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.filename));

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
        throw new Error(`Falló la migración ${file}: ${err.message}`);
      }
    }
    return { applied, skipped };
  } finally {
    client.release();
  }
}

// `npm run migrate`: solo necesita DATABASE_URL, no el resto de la configuración.
if (require.main === module) {
  require('dotenv').config({ quiet: true });
  let pool;
  (async () => {
    pool = createPool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const { applied, skipped } = await runMigrations({ pool });
    console.log(`Migraciones en ${EXPECTED_DATABASE}. Aplicadas: [${applied.join(', ')}]. Ya existentes: ${skipped.length}.`);
  })()
    .catch((err) => {
      console.error('Error al ejecutar migraciones:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool && pool.end());
}

module.exports = { runMigrations, DEFAULT_MIGRATIONS_DIR };
