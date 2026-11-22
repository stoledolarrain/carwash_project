const crypto = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Asigna un identificador de correlación a cada petición (reutiliza el `X-Request-Id` del API Gateway si es válido)
 * y registra una línea por petición: método, ruta, estado y duración. Nunca registra cuerpos ni tokens.
 */
function createRequestContext({ logger = console, enabled = true } = {}) {
  return function requestContext(req, res, next) {
    const incoming = req.get('X-Request-Id');
    req.id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    res.set('X-Request-Id', req.id);

    if (enabled) {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        logger.log(`[HTTP] ${req.id} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms`);
      });
    }
    next();
  };
}

module.exports = { createRequestContext };
