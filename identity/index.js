const { loadConfig } = require('./src/config/env');
const { buildContainer, buildPersistence } = require('./src/container');
const { createApp } = require('./src/app');

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[CONFIG] ${err.message}`);
    process.exit(1);
  }

  const persistence = await buildPersistence(config);
  if (persistence.kind === 'postgres') {
    console.log('[DB] Conectado a PostgreSQL (identity_db). Migraciones al día.');
  } else {
    console.warn('[DB] Sin DATABASE_URL: persistencia en memoria, los usuarios se pierden al reiniciar.');
  }

  const container = buildContainer({ config, repository: persistence.repository });

  const bootstrap = await container.commands.bootstrapAdmin.execute(config.bootstrapAdmin);
  if (bootstrap.created) {
    console.log(`[BOOTSTRAP] Administrador inicial creado: ${bootstrap.user.email}`);
  } else {
    console.log(`[BOOTSTRAP] No se creó administrador inicial: ${bootstrap.reason}`);
  }

  const app = createApp(container);
  const server = app.listen(config.port, () => {
    console.log(`Identity Service escuchando en el puerto ${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} recibido, cerrando Identity Service...`);
    try {
      await new Promise((resolve) => server.close(resolve));
      await persistence.close();
    } catch (err) {
      console.error('Error durante el cierre:', err.message);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Error al iniciar Identity Service:', err.message);
  process.exit(1);
});
