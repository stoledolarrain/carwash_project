const jwt = require('jsonwebtoken');

const MIN_SECRET_LENGTH = 32;
const VALID_ROLES = Object.freeze(['ADMIN', 'RECEPTIONIST', 'WASHER']);

function unauthorized(message) {
  const err = new Error(message);
  err.status = 401;
  err.code = 'UNAUTHORIZED';
  return err;
}

/**
 * Middleware que verifica el JWT emitido por Identity Service y deja `req.auth = { userId, role }`,
 * que es exactamente el contrato que ya espera `requireRole('ADMIN')`. Controladores y casos de uso no cambian.
 *
 * - Sin encabezado Authorization: continúa sin `req.auth`. Las rutas públicas funcionan y las
 *   administrativas responden 401 desde `requireRole`.
 * - Con encabezado inválido, token con firma incorrecta, vencido, de otro emisor/audiencia o con rol
 *   desconocido: 401 inmediato.
 * - Nunca lee encabezados como `X-User-Role`: el rol sale solo del token firmado.
 *
 * Vive en infrastructure (usa `jsonwebtoken`) y se inyecta desde index.js mediante `authContextMiddleware`.
 */
function createJwtAuthContextMiddleware({ secret, issuer, audience }) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres (el mismo de Identity Service).`);
  }
  const verifyOptions = { algorithms: ['HS256'], issuer, audience };

  return function jwtAuthContext(req, _res, next) {
    const header = req.headers.authorization;
    if (header === undefined) {
      return next();
    }

    const match = typeof header === 'string' ? header.match(/^Bearer\s+(\S+)$/i) : null;
    if (!match) {
      return next(unauthorized('Se requiere el encabezado Authorization: Bearer <token>.'));
    }

    let payload;
    try {
      payload = jwt.verify(match[1], secret, verifyOptions);
    } catch (err) {
      return next(
        unauthorized(
          err instanceof jwt.TokenExpiredError
            ? 'El token de acceso expiró. Inicie sesión nuevamente.'
            : 'El token de acceso es inválido.'
        )
      );
    }

    if (typeof payload.sub !== 'string' || !VALID_ROLES.includes(payload.role)) {
      return next(unauthorized('El token de acceso es inválido.'));
    }

    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  };
}

module.exports = { createJwtAuthContextMiddleware, MIN_SECRET_LENGTH };
