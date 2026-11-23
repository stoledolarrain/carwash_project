const jwt = require('jsonwebtoken');

const ROLES_VALIDOS = Object.freeze(['ADMIN', 'RECEPTIONIST', 'WASHER']);

function noAutenticado(res, mensaje) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: mensaje } });
}

/**
 * Middleware que exige un JWT válido emitido por Identity Service y deja `req.auth = { userId, role }`.
 * Valida firma HS256, expiración, emisor y audiencia. El rol sale solo del token firmado:
 * nunca de encabezados como `X-User-Role`.
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

module.exports = { crearAutenticacionJwt, ROLES_VALIDOS };
