const { buildContainer } = require('./src/container');
const { createApp } = require('./src/app');

const container = buildContainer();
const app = createApp(container);

const server = app.listen(container.config.port, () => {
  console.log(`Catalog Service escuchando en el puerto ${container.config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} recibido, cerrando Catalog Service...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
