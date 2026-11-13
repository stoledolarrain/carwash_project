const { buildContainer } = require('./src/container');
const { createApp } = require('./src/app');
const { closePool } = require('./src/infrastructure/database/pool');
const { closeKafkaEventPublisher } = require('./src/infrastructure/messaging/KafkaEventPublisher');

const container = buildContainer();

/**
 * En desarrollo local (mientras Identity Service y API Gateway aún no están integrados),
 * si se define `DEV_AUTH_ROLE` (por ejemplo `DEV_AUTH_ROLE=ADMIN` o `DEV_AUTH_ROLE=OPERATOR`),
 * se inyecta un contexto `req.auth` controlado desde la configuración del servidor
 * (nunca desde encabezados arbitrarios del cliente).
 */
const devAuthMiddleware =
  container.config.devAuthRole && container.config.nodeEnv !== 'production'
    ? (req, _res, next) => {
        req.auth = {
          userId: 'dev-local-user',
          role: container.config.devAuthRole
        };
        next();
      }
    : undefined;

const app = createApp(container, { authContextMiddleware: devAuthMiddleware });

const server = app.listen(container.config.port, () => {
  console.log(`Catalog Service escuchando en el puerto ${container.config.port}`);
  if (devAuthMiddleware) {
    console.log(`[DEV AUTH] Contexto de desarrollo activo con rol: ${container.config.devAuthRole}`);
  }
  container.outboxWorker.start();
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} recibido, cerrando Catalog Service...`);
  try {
    // 1) Dejar de aceptar conexiones HTTP nuevas y esperar las solicitudes en curso,
    // 2) detener el worker, 3) desconectar Kafka y 4) cerrar el pool de PostgreSQL.
    await new Promise((resolve) => server.close(resolve));
    await container.outboxWorker.stop();
    await closeKafkaEventPublisher();
    await closePool();
  } catch (err) {
    console.error('Error durante el cierre ordenado:', err.message);
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
