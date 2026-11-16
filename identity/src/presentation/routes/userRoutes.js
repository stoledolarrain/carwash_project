const express = require('express');
const { requireRole } = require('../middlewares/requireRole');
const { ROLES } = require('../../domain/value-objects/Role');

/**
 * Rutas de administración bajo /api/identity/users (todas requieren rol ADMIN).
 * Separadas por CQRS: GET -> queries; POST/PATCH -> commands.
 */
function createUserRouter({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate, requireRole(ROLES.ADMIN));

  // Queries
  router.get('/', controller.list);
  router.get('/:id', controller.getById);

  // Commands
  router.post('/', controller.create);
  router.patch('/:id', controller.updateProfile);
  router.patch('/:id/role', controller.changeRole);
  router.patch('/:id/password', controller.resetPassword);
  router.patch('/:id/activate', controller.activate);
  router.patch('/:id/deactivate', controller.deactivate);

  return router;
}

/** GET /api/identity/roles (cualquier usuario autenticado). */
function createRoleRouter({ controller, authenticate }) {
  const router = express.Router();
  router.get('/', authenticate, controller.listRoles);
  return router;
}

module.exports = { createUserRouter, createRoleRouter };
