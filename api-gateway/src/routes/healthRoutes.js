const express = require('express');

async function checkService(route, timeoutMs) {
  const started = Date.now();
  try {
    const response = await fetch(new URL('/health', route.target), { signal: AbortSignal.timeout(timeoutMs) });
    return {
      service: route.name,
      status: response.ok ? 'up' : 'down',
      httpStatus: response.status,
      latencyMs: Date.now() - started
    };
  } catch {
    return { service: route.name, status: 'down', httpStatus: null, latencyMs: Date.now() - started };
  }
}

/**
 * GET /health           -> estado del propio Gateway.
 * GET /health/services  -> consulta el /health de cada microservicio (200 si todos responden, 503 si alguno falla).
 */
function createHealthRouter({ routes, timeoutMs = 2000 }) {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
  });

  router.get('/health/services', async (_req, res) => {
    const services = await Promise.all(routes.map((route) => checkService(route, timeoutMs)));
    const allUp = services.every((s) => s.status === 'up');
    res.status(allUp ? 200 : 503).json({
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services
    });
  });

  return router;
}

module.exports = { createHealthRouter };
