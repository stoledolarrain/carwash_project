const { loadConfig } = require('./src/config/env');
const { createApp } = require('./src/app');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[CONFIG] ${err.message}`);
  process.exit(1);
}

const app = createApp(config);
const server = app.listen(config.port, () => {
  console.log(`API Gateway escuchando en el puerto ${config.port}`);
  for (const [name, url] of Object.entries(config.services)) {
    console.log(`  /api/${name}/* -> ${url}`);
  }
  console.log(`  CORS permitido para: ${config.corsOrigins.join(', ')}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} recibido, cerrando API Gateway...`);
  server.close(() => process.exit(0));
  // Si alguna conexión queda colgada, no bloquear el cierre indefinidamente.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
