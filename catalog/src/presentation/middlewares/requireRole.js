const ADMIN_ROLE = 'ADMIN';

function extractRoles(auth) {
  if (!auth || typeof auth !== 'object') {
    return [];
  }
  const roles = [];
  if (typeof auth.role === 'string') {
    roles.push(auth.role.toUpperCase());
  }
  if (Array.isArray(auth.roles)) {
    for (const r of auth.roles) {
      if (typeof r === 'string') {
        roles.push(r.toUpperCase());
      }
    }
  }
  return roles;
}

/**
 * Middleware de autorización para rutas administrativas (`/api/catalog/admin/*`).
 *
 * Seguridad:
 * - Verifica exclusivamente un contexto de autenticación confiable en `req.auth`
 *   (inyectado por el middleware de autenticación del servicio / integración con API Gateway e Identity Service,
 *   o mediante `authContextMiddleware` en pruebas controladas).
 * - NO confía en encabezados HTTP arbitrarios enviados por el cliente (como `X-User-Role` o `X-Admin`).
 * - Responde `401 UNAUTHORIZED` si `req.auth` no existe o no identifica a un usuario autenticado.
 * - Responde `403 FORBIDDEN` si el usuario autenticado no posee el rol requerido (`ADMIN`).
 */
function requireRole(requiredRole = ADMIN_ROLE) {
  const normalizedRequired = String(requiredRole).toUpperCase();

  return function roleGuard(req, res, next) {
    const auth = req.auth;

    if (!auth || typeof auth !== 'object' || (!auth.userId && !auth.sub && !auth.role && !auth.roles)) {
      const err = new Error('Autenticación requerida para acceder a este recurso administrativo.');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      return next(err);
    }

    const roles = extractRoles(auth);
    if (!roles.includes(normalizedRequired)) {
      const err = new Error('No tiene permisos suficientes para realizar esta operación.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }

    return next();
  };
}

const requireAdmin = requireRole(ADMIN_ROLE);

module.exports = {
  ADMIN_ROLE,
  requireRole,
  requireAdmin
};
