const { InvalidTokenError } = require('../../application/errors/ApplicationErrors');
const { extractBearerToken } = require('../validators/userValidators');

/**
 * Exige un `Authorization: Bearer <JWT>` válido y deja el contexto en `req.auth = { userId, email, role, permissions }`.
 * Es el mismo contrato de `req.auth` que ya espera `requireRole` en Catalog Service.
 * Nunca confía en encabezados como `X-User-Role` enviados por el cliente.
 */
function createAuthenticate({ verifyAccessToken }) {
  return async function authenticate(req, _res, next) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return next(new InvalidTokenError('Se requiere el encabezado Authorization: Bearer <token>.'));
    }
    req.auth = await verifyAccessToken.execute({ token });
    return next();
  };
}

module.exports = { createAuthenticate };
