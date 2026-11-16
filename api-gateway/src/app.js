const express = require('express');
const cors = require('cors');
const { buildServiceRoutes } = require('./config/services');
const { createRequestContext } = require('./middlewares/requestContext');
const { createRateLimiter } = require('./middlewares/rateLimiter');
const { createRoutePolicy } = require('./middlewares/routePolicy');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { createServiceProxy } = require('./proxy/serviceProxy');
const { createHealthRouter } = require('./routes/healthRoutes');

/**
 * Orden de la cadena de cada petición:
 * request id -> CORS -> límite de peticiones -> health -> política de ruta (404 / pública / JWT) -> proxy -> errores.
 *
 * El Gateway NO usa express.json(): los cuerpos se reenvían como llegan, sin leerlos.
 *
 * @param {ReturnType<typeof import('./config/env').loadConfig>} config
 * @param {{ logRequests?: boolean, healthTimeoutMs?: number }} [options]
 */
function createApp(config, { logRequests = true, healthTimeoutMs = 2000 } = {}) {
  const app = express();
  const routes = buildServiceRoutes(config);

  app.disable('x-powered-by');
  app.use(createRequestContext({ enabled: logRequests }));
  app.use(
    cors({
      // Sin encabezado Origin (Postman, curl, otros servicios) no aplica CORS.
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS_NOT_ALLOWED'));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Location', 'Retry-After'],
      maxAge: 600
    })
  );
  app.use(createRateLimiter(config.rateLimit));
  app.use(createHealthRouter({ routes, timeoutMs: healthTimeoutMs }));

  app.use('/api', createRoutePolicy({ routes, jwtConfig: config.jwt }), createServiceProxy({ timeoutMs: config.proxyTimeoutMs }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
