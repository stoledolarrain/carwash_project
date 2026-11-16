/**
 * Limitador de intentos por IP con ventana fija, en memoria.
 * Protege el login contra ataques de fuerza bruta. Al escalar a varias réplicas
 * convendría moverlo a un almacén compartido (Redis) o al API Gateway.
 */
function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const key = req.ip || 'desconocido';
    const current = now();
    let entry = hits.get(key);

    if (!entry || current >= entry.resetAt) {
      entry = { count: 0, resetAt: current + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 10000) {
      for (const [k, v] of hits) {
        if (current >= v.resetAt) hits.delete(k);
      }
    }

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - current) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `Demasiados intentos. Intente de nuevo en ${retryAfterSeconds} segundos.`
        }
      });
    }
    return next();
  };
}

module.exports = { createRateLimiter };
