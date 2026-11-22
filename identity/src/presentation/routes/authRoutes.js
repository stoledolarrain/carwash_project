const express = require('express');

/**
 * Rutas de autenticación bajo /api/identity/auth
 *   POST  /login          público (con límite de intentos)
 *   POST  /verify         público: lo usa el API Gateway para validar tokens
 *   GET   /me             autenticado
 *   PATCH /me/password    autenticado
 */
function createAuthRouter({ controller, authenticate, loginRateLimiter }) {
  const router = express.Router();

  router.post('/login', loginRateLimiter, controller.login);
  router.post('/verify', controller.verify);
  router.get('/me', authenticate, controller.me);
  router.patch('/me/password', authenticate, controller.changeOwnPassword);

  return router;
}

module.exports = { createAuthRouter };
