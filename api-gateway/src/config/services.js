/**
 * Tabla de enrutamiento del Gateway: a qué microservicio va cada prefijo y qué rutas son públicas.
 *
 * Política por defecto: TODA ruta de un servicio exige un JWT válido, salvo las listadas en `publicRoutes`.
 * Es más seguro olvidarse de abrir una ruta que olvidarse de cerrarla.
 * `blockedRoutes` son endpoints internos que existen en el servicio pero no se exponen hacia afuera.
 *
 * Para agregar Catalog, Wash Order, etc., basta con sumar una entrada aquí y su URL en `config/env.js`.
 */
function buildServiceRoutes(config) {
  return Object.freeze([
    Object.freeze({
      name: 'identity',
      prefix: '/api/identity',
      target: config.services.identity,
      publicRoutes: Object.freeze([{ method: 'POST', path: '/api/identity/auth/login' }]),
      // Validación de tokens entre servicios; el Gateway ya valida por su cuenta y no necesita exponerla.
      blockedRoutes: Object.freeze([{ method: 'POST', path: '/api/identity/auth/verify' }])
    })
  ]);
}

function normalizePath(path) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function matchesRoute(rules, method, path) {
  return rules.some((rule) => rule.method === method && rule.path === path);
}

/** Devuelve el servicio que atiende la ruta, o null si ningún servicio la reconoce. */
function findServiceRoute(routes, path) {
  const normalized = normalizePath(path);
  return routes.find((route) => matchesPrefix(normalized, route.prefix)) || null;
}

module.exports = { buildServiceRoutes, findServiceRoute, matchesRoute, normalizePath };
