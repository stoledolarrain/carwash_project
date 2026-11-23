/**
 * Autorización por rol. Va después del middleware de autenticación JWT.
 * Responde 403 si el rol del usuario autenticado no está entre los permitidos.
 */
function requerirRol(...rolesPermitidos) {
  return function verificarRol(req, res, next) {
    if (!req.auth || !rolesPermitidos.includes(req.auth.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'No tiene permisos suficientes para realizar esta operación.' }
      });
    }
    return next();
  };
}

/**
 * Consultar y crear notificaciones: administración y recepción.
 * Payment crea notificaciones reenviando el token del usuario que registró el pago,
 * y ese usuario siempre es ADMIN o RECEPTIONIST (los únicos que pueden registrar pagos).
 */
const ROLES_NOTIFICACIONES = Object.freeze(['ADMIN', 'RECEPTIONIST']);

module.exports = { requerirRol, ROLES_NOTIFICACIONES };
