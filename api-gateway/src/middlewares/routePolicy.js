const jwt = require('jsonwebtoken');
const { gatewayErrors } = require('../errors');
const { findServiceRoute, matchesRoute, normalizePath } = require('../config/services');

function extractBearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/**
 * Decide qué pasa con cada petición antes de reenviarla:
 * 1. Si ningún servicio atiende la ruta -> 404 del Gateway.
 * 2. Si es una ruta interna bloqueada -> 404 (no se revela que existe).
 * 3. Si es pública -> pasa sin token.
 * 4. En cualquier otro caso exige un JWT válido (firma HS256, expiración, emisor y audiencia).
 *
 * El Gateway es la primera barrera, no la única: cada microservicio vuelve a validar el token
 * y aplica su propia autorización por rol. Identity además detecta tokens revocados.
 */
function createRoutePolicy({ routes, jwtConfig }) {
  const verifyOptions = {
    algorithms: ['HS256'],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  };

  return function routePolicy(req, _res, next) {
    // Montado en /api, Express quita ese prefijo de req.path: se reconstruye la ruta completa.
    const fullPath = `${req.baseUrl}${req.path}`;
    const route = findServiceRoute(routes, fullPath);
    if (!route) {
      return next(gatewayErrors.notFound(req.method, fullPath));
    }

    const path = normalizePath(fullPath);
    if (matchesRoute(route.blockedRoutes, req.method, path)) {
      return next(gatewayErrors.notFound(req.method, fullPath));
    }

    req.serviceRoute = route;
    // Las peticiones preflight de CORS nunca llevan token.
    if (req.method === 'OPTIONS' || matchesRoute(route.publicRoutes, req.method, path)) {
      return next();
    }

    const token = extractBearerToken(req.get('Authorization'));
    if (!token) {
      return next(gatewayErrors.unauthorized('Se requiere el encabezado Authorization: Bearer <token>.'));
    }
    try {
      const payload = jwt.verify(token, jwtConfig.secret, verifyOptions);
      req.auth = { userId: payload.sub, role: payload.role };
      return next();
    } catch (err) {
      const message =
        err instanceof jwt.TokenExpiredError
          ? 'El token de acceso expiró. Inicie sesión nuevamente.'
          : 'El token de acceso es inválido.';
      return next(gatewayErrors.unauthorized(message));
    }
  };
}

module.exports = { createRoutePolicy, extractBearerToken };
