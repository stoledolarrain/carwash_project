const { loadConfig } = require('./src/config/env');
const { buildContainer } = require('./src/container');
const { createApp } = require('./src/app');

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[CONFIG] ${err.message}`);
    process.exit(1);
  }

  const container = buildContainer({ config });

  const bootstrap = await container.commands.bootstrapAdmin.execute(config.bootstrapAdmin);
  if (bootstrap.created) {
    console.log(`[BOOTSTRAP] Administrador inicial creado: ${bootstrap.user.email}`);
  } else {
    console.log(`[BOOTSTRAP] No se creó administrador inicial: ${bootstrap.reason}`);
  }

  const app = createApp(container);
  const server = app.listen(config.port, () => {
    console.log(`Identity Service escuchando en el puerto ${config.port}`);
    console.log('[AVISO] Persistencia en memoria: los usuarios se pierden al reiniciar (pendiente PostgreSQL).');
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} recibido, cerrando Identity Service...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Error al iniciar Identity Service:', err.message);
  process.exit(1);
});
