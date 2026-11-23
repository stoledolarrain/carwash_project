const jwt = require('jsonwebtoken');

const LONGITUD_MINIMA_SECRETO = 32;
const ROLES_VALIDOS = Object.freeze(['ADMIN', 'RECEPTIONIST', 'WASHER']);

/**
 * Configuración JWT de Identity Service. JWT_SECRET, JWT_ISSUER y JWT_AUDIENCE deben ser
 * exactamente los mismos de identity/.env y api-gateway/.env. Falla al arrancar si falta el secreto.
 */
function cargarConfiguracionJwt(entorno = process.env) {
  const secret = entorno.JWT_SECRET || '';
  if (secret.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRET es obligatorio y debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres (el mismo de Identity Service). Revise notification/.env.`
    );
  }
  return Object.freeze({
    secret,
    issuer: entorno.JWT_ISSUER || 'carwash-identity',
    audience: entorno.JWT_AUDIENCE || 'carwash-platform'
  });
}

function noAutenticado(res, mensaje) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: mensaje } });
}

/**
 * Exige un JWT válido de Identity Service (firma HS256, expiración, emisor y audiencia)
 * y deja `req.auth = { userId, role }`. El rol sale solo del token firmado.
 */
function crearAutenticacionJwt({ secret, issuer, audience }) {
  const opciones = { algorithms: ['HS256'], issuer, audience };

  return function autenticar(req, res, next) {
    const encabezado = req.headers.authorization;
    const coincidencia = typeof encabezado === 'string' ? encabezado.match(/^Bearer\s+(\S+)$/i) : null;
    if (!coincidencia) {
      return noAutenticado(res, 'Se requiere el encabezado Authorization: Bearer <token>.');
    }

    let payload;
    try {
      payload = jwt.verify(coincidencia[1], secret, opciones);
    } catch (error) {
      return noAutenticado(
        res,
        error instanceof jwt.TokenExpiredError
          ? 'El token de acceso expiró. Inicie sesión nuevamente.'
          : 'El token de acceso es inválido.'
      );
    }

    if (typeof payload.sub !== 'string' || !ROLES_VALIDOS.includes(payload.role)) {
      return noAutenticado(res, 'El token de acceso es inválido.');
    }

    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  };
}

module.exports = { cargarConfiguracionJwt, crearAutenticacionJwt, LONGITUD_MINIMA_SECRETO };
