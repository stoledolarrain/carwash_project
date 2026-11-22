/**
 * Autorización por rol. Debe ir después de `authenticate`.
 * Responde 401 si no hay contexto autenticado y 403 si el rol no está permitido.
 * Autenticarse no implica estar autorizado.
 */
function requireRole(...allowedRoles) {
  const normalized = allowedRoles.map((role) => String(role).toUpperCase());

  return function roleGuard(req, _res, next) {
    if (!req.auth || !req.auth.userId) {
      const err = new Error('Autenticación requerida.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      return next(err);
    }
    if (!normalized.includes(String(req.auth.role).toUpperCase())) {
      const err = new Error('No tiene permisos suficientes para realizar esta operación.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }
    return next();
  };
}

module.exports = { requireRole };
