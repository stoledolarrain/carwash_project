const crypto = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Asigna un `X-Request-Id` a cada petición (lo reenvía a los microservicios para correlacionar logs)
 * y registra una línea por petición: id, método, ruta, servicio destino, estado y duración.
 * Nunca registra cuerpos, tokens ni la query string.
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
        const target = req.serviceRoute ? req.serviceRoute.name : 'gateway';
        const path = req.originalUrl.split('?')[0];
        logger.log(`[HTTP] ${req.id} ${req.method} ${path} -> ${target} ${res.statusCode} ${ms.toFixed(1)}ms`);
      });
    }
    next();
  };
}

module.exports = { createRequestContext };
