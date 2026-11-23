/**
 * Tabla de enrutamiento del Gateway: a qué microservicio va cada prefijo y qué rutas son públicas.
 *
 * Política por defecto: TODA ruta de un servicio exige un JWT válido, salvo las listadas en `publicRoutes`.
 * Es más seguro olvidarse de abrir una ruta que olvidarse de cerrarla.
 * `blockedRoutes` son endpoints internos (los usan otros microservicios llamándose directamente)
 * que no se exponen hacia afuera: el Gateway responde 404.
 * Las rutas admiten parámetros con `:nombre`, por ejemplo `/api/catalog/services/:id`.
 * `healthPath` es la ruta de salud del servicio que consulta `GET /health/services`.
 *
 * Para agregar un servicio: una entrada aquí y su URL en `config/env.js` (más la variable en .env).
 */
function buildServiceRoutes(config) {
  const { services } = config;
  return Object.freeze(
    [
      {
        name: 'identity',
        prefix: '/api/identity',
        target: services.identity,
        publicRoutes: [{ method: 'POST', path: '/api/identity/auth/login' }],
        // Validación de tokens entre servicios; el Gateway ya valida por su cuenta.
        blockedRoutes: [{ method: 'POST', path: '/api/identity/auth/verify' }]
      },
      {
        name: 'catalog',
        prefix: '/api/catalog',
        target: services.catalog,
        // Catalog define la consulta de servicios activos como pública.
        publicRoutes: [
          { method: 'GET', path: '/api/catalog/services' },
          { method: 'GET', path: '/api/catalog/services/:id' }
        ],
        // Consulta por lote pensada para que Wash Order valide servicios y precios llamando directo a Catalog.
        blockedRoutes: [{ method: 'POST', path: '/api/catalog/services/batch' }]
      },
      {
        name: 'customer',
        prefix: '/api/customer',
        target: services.customer
      },
      {
        name: 'wash-order',
        prefix: '/api/orders',
        target: services.washOrder
      },
      {
        name: 'payment',
        prefix: '/api/payments',
        target: services.payment,
        healthPath: '/api/payments/health'
      },
      {
        name: 'notification',
        prefix: '/api/notifications',
        target: services.notification,
        // Las notificaciones las crean otros servicios (p. ej. Payment) llamando directo; desde afuera solo se consultan.
        blockedRoutes: [{ method: 'POST', path: '/api/notifications' }]
      }
    ].map(freezeRoute)
  );
}

function compileRule({ method, path }) {
  const pattern = path
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return Object.freeze({ method, path, regex: new RegExp(`^${pattern}$`) });
}

function freezeRoute(route) {
  return Object.freeze({
    ...route,
    healthPath: route.healthPath || '/health',
    publicRoutes: Object.freeze((route.publicRoutes || []).map(compileRule)),
    blockedRoutes: Object.freeze((route.blockedRoutes || []).map(compileRule))
  });
}

function normalizePath(path) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function matchesRoute(rules, method, path) {
  return rules.some((rule) => rule.method === method && rule.regex.test(path));
}

/** Devuelve el servicio que atiende la ruta, o null si ningún servicio la reconoce. */
function findServiceRoute(routes, path) {
  const normalized = normalizePath(path);
  return routes.find((route) => matchesPrefix(normalized, route.prefix)) || null;
}

module.exports = { buildServiceRoutes, findServiceRoute, matchesRoute, normalizePath };
