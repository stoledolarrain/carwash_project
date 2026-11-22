const { UserNotFoundError, LastAdminError, ForbiddenOperationError } = require('../errors/ApplicationErrors');

/** Carga un usuario o lanza `UserNotFoundError`. */
async function loadUserOrFail(repository, id) {
  const user = await repository.findById(id);
  if (!user) {
    throw new UserNotFoundError(id);
  }
  return user;
}

/**
 * Regla de negocio: la plataforma siempre debe tener al menos un administrador activo,
 * de lo contrario nadie podría volver a gestionar usuarios.
 */
async function ensureNotLastActiveAdmin(repository, user) {
  if (!user.isAdmin() || !user.isActive) {
    return;
  }
  const activeAdmins = await repository.countActiveAdmins();
  if (activeAdmins <= 1) {
    throw new LastAdminError();
  }
}

/** Un administrador no puede cambiar su propio rol ni desactivarse: evita bloquearse fuera del sistema. */
function ensureNotSelf(actorId, targetId, action) {
  if (actorId && actorId === targetId) {
    throw new ForbiddenOperationError(`No puede ${action} su propia cuenta.`);
  }
}

module.exports = { loadUserOrFail, ensureNotLastActiveAdmin, ensureNotSelf };
