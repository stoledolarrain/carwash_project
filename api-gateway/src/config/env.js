require('dotenv').config({ quiet: true });

const DEFAULT_PORT = 8080;
const MIN_SECRET_LENGTH = 32;

function parsePort(value, fallback = DEFAULT_PORT) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseServiceUrl(name, value) {
  if (!value) {
    throw new Error(`${name} es obligatorio (URL del microservicio).`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} no es una URL válida: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} debe usar http o https.`);
  }
  return url.origin;
}

/**
 * Configuración del Gateway. Las URLs de los microservicios vienen de variables de entorno
 * para que en Docker baste con cambiarlas (p. ej. http://identity:3001) sin tocar el código.
 */
function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET es obligatorio, debe tener al menos ${MIN_SECRET_LENGTH} caracteres y ser el mismo que usa Identity Service.`
    );
  }

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    jwt: Object.freeze({
      secret: jwtSecret,
      issuer: env.JWT_ISSUER || 'carwash-identity',
      audience: env.JWT_AUDIENCE || 'carwash-platform'
    }),
    services: Object.freeze({
      identity: parseServiceUrl('IDENTITY_SERVICE_URL', env.IDENTITY_SERVICE_URL || 'http://localhost:3001'),
      catalog: parseServiceUrl('CATALOG_SERVICE_URL', env.CATALOG_SERVICE_URL || 'http://localhost:3002'),
      customer: parseServiceUrl('CUSTOMER_SERVICE_URL', env.CUSTOMER_SERVICE_URL || 'http://localhost:3005'),
      washOrder: parseServiceUrl('WASH_ORDER_SERVICE_URL', env.WASH_ORDER_SERVICE_URL || 'http://localhost:3000'),
      payment: parseServiceUrl('PAYMENT_SERVICE_URL', env.PAYMENT_SERVICE_URL || 'http://localhost:3003'),
      notification: parseServiceUrl('NOTIFICATION_SERVICE_URL', env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004')
    }),
    corsOrigins: Object.freeze(
      (env.CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
    proxyTimeoutMs: parsePositiveInteger(env.PROXY_TIMEOUT_MS, 10000),
    rateLimit: Object.freeze({
      max: parsePositiveInteger(env.RATE_LIMIT_MAX, 300),
      windowMs: parsePositiveInteger(env.RATE_LIMIT_WINDOW_MS, 60000)
    })
  });
}

module.exports = { DEFAULT_PORT, MIN_SECRET_LENGTH, loadConfig };
