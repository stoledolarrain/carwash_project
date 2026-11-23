const { buildContainer } = require('./src/container');
const { createApp } = require('./src/app');
const { closePool } = require('./src/infrastructure/database/pool');
const { closeKafkaEventPublisher } = require('./src/infrastructure/messaging/KafkaEventPublisher');
const { createJwtAuthContextMiddleware } = require('./src/infrastructure/security/jwtAuthContext');

const container = buildContainer();
const { config } = container;

/**
 * Autenticación:
 * - Con JWT_SECRET: se verifican los JWT de Identity Service (modo normal, también detrás del API Gateway).
 * - Sin JWT_SECRET y con DEV_AUTH_ROLE (solo fuera de producción): se inyecta un rol fijo de desarrollo,
 *   controlado desde la configuración del servidor y nunca desde encabezados del cliente.
 * - Sin ninguno: las rutas administrativas responden 401.
 */
let authContextMiddleware;
let authMode;
if (config.jwt.secret) {
  authContextMiddleware = createJwtAuthContextMiddleware(config.jwt);
  authMode = 'JWT de Identity Service';
} else if (config.devAuthRole && config.nodeEnv !== 'production') {
  authContextMiddleware = (req, _res, next) => {
    req.auth = { userId: 'dev-local-user', role: config.devAuthRole };
    next();
  };
  authMode = `[DEV AUTH] rol fijo ${config.devAuthRole}`;
} else {
  authMode = 'sin autenticación configurada: las rutas /admin responderán 401';
}

const app = createApp(container, { authContextMiddleware });

const server = app.listen(config.port, () => {
  console.log(`Catalog Service escuchando en el puerto ${config.port}`);
  console.log(`Autenticación: ${authMode}`);
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
