require('dotenv').config({ quiet: true });

const DEFAULT_PORT = 3001;
const MIN_SECRET_LENGTH = 32;

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Lee y valida la configuración. Falla al arrancar (fail securely) si falta un secreto JWT robusto,
 * en lugar de levantar el servicio con un valor por defecto inseguro.
 */
function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET es obligatorio y debe tener al menos ${MIN_SECRET_LENGTH} caracteres. Revise el archivo .env (ver .env.example).`
    );
  }

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    // Número de proxies de confianza delante del servicio (1 detrás del API Gateway). 0 = ninguno.
    trustProxy: Number.parseInt(env.TRUST_PROXY, 10) > 0 ? Number.parseInt(env.TRUST_PROXY, 10) : false,
    jwt: Object.freeze({
      secret: jwtSecret,
      expiresIn: env.JWT_EXPIRES_IN || '1h',
      issuer: env.JWT_ISSUER || 'carwash-identity',
      audience: env.JWT_AUDIENCE || 'carwash-platform'
    }),
    bcryptRounds: Math.min(parsePositiveInteger(env.BCRYPT_ROUNDS, 10), 15),
    bootstrapAdmin: Object.freeze({
      email: env.ADMIN_EMAIL || null,
      password: env.ADMIN_PASSWORD || null,
      fullName: env.ADMIN_FULL_NAME || 'Administrador General'
    }),
    loginRateLimit: Object.freeze({
      max: parsePositiveInteger(env.LOGIN_RATE_LIMIT_MAX, 10),
      windowMs: parsePositiveInteger(env.LOGIN_RATE_LIMIT_WINDOW_MS, 60000)
    })
  });
}

module.exports = { DEFAULT_PORT, MIN_SECRET_LENGTH, loadConfig };
