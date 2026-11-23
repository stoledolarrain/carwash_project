const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Configuración JWT de Identity Service. JWT_SECRET, JWT_ISSUER y JWT_AUDIENCE deben ser
 * exactamente los mismos de identity/.env y api-gateway/.env.
 * Falla al arrancar si falta el secreto: sin él no se puede saber quién hace cada petición.
 */
function cargarConfiguracionJwt(entorno = process.env) {
  const secret = entorno.JWT_SECRET || '';
  if (secret.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRET es obligatorio y debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres (el mismo de Identity Service). Revise wash_order/.env.`
    );
  }
  return Object.freeze({
    secret,
    issuer: entorno.JWT_ISSUER || 'carwash-identity',
    audience: entorno.JWT_AUDIENCE || 'carwash-platform'
  });
}

module.exports = { cargarConfiguracionJwt, LONGITUD_MINIMA_SECRETO };
