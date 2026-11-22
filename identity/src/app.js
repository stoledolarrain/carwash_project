const express = require('express');
const AuthController = require('./presentation/controllers/AuthController');
const UserController = require('./presentation/controllers/UserController');
const { createAuthenticate } = require('./presentation/middlewares/authenticate');
const { createRateLimiter } = require('./presentation/middlewares/rateLimiter');
const { createRequestContext } = require('./presentation/middlewares/requestContext');
const { notFoundHandler, errorHandler } = require('./presentation/middlewares/errorHandler');
const { createHealthRouter } = require('./presentation/routes/healthRoutes');
const { createAuthRouter } = require('./presentation/routes/authRoutes');
const { createUserRouter, createRoleRouter } = require('./presentation/routes/userRoutes');

/**
 * Crea la aplicación Express 5 sin llamar a `listen` (así las pruebas la usan con supertest).
 * @param {ReturnType<typeof import('./container').buildContainer>} container
 * @param {{ logRequests?: boolean }} [options]
 */
function createApp(container, { logRequests = true } = {}) {
  const { commands, queries, config } = container;
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) {
    app.set('trust proxy', config.trustProxy);
  }

  app.use(createRequestContext({ enabled: logRequests }));
  app.use(express.json({ limit: '10kb' }));

  const authenticate = createAuthenticate({ verifyAccessToken: queries.verifyAccessToken });
  const loginRateLimiter = createRateLimiter(config.loginRateLimit);
  const authController = new AuthController({ commands, queries });
  const userController = new UserController({ commands, queries });

  app.use(createHealthRouter());
  app.use('/api/identity/auth', createAuthRouter({ controller: authController, authenticate, loginRateLimiter }));
  app.use('/api/identity/roles', createRoleRouter({ controller: authController, authenticate }));
  app.use('/api/identity/users', createUserRouter({ controller: userController, authenticate }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
