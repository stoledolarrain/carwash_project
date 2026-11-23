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

/** Roles por acción, según los permisos que define Identity Service. */
const ROLES = Object.freeze({
  // orders:read / orders:read-assigned: todo el personal ve la cola de trabajo.
  CONSULTAR: Object.freeze(['ADMIN', 'RECEPTIONIST', 'WASHER']),
  // orders:create y orders:assign: recepción y administración.
  CREAR_Y_ASIGNAR: Object.freeze(['ADMIN', 'RECEPTIONIST']),
  // orders:change-status: el lavador marca su trabajo como terminado.
  FINALIZAR: Object.freeze(['ADMIN', 'RECEPTIONIST', 'WASHER']),
  // La entrega al cliente la hace recepción.
  ENTREGAR: Object.freeze(['ADMIN', 'RECEPTIONIST'])
});

module.exports = { requerirRol, ROLES };
