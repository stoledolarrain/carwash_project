const { GatewayError } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` }
  });
}

/** Mismo formato de error que los microservicios: `{ error: { code, message } }`. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Error interno del Gateway.';

  if (err instanceof GatewayError) {
    ({ status, code, message } = err);
  } else if (err && err.message === 'CORS_NOT_ALLOWED') {
    status = 403;
    code = 'CORS_NOT_ALLOWED';
    message = 'Origen no permitido por la política CORS.';
  }

  if (status >= 500) {
    console.error(`[ERROR] ${req.id || '-'} ${code}`, err && err.cause ? err.cause.message : err.message);
  }
  if (status === 401) {
    res.set('WWW-Authenticate', 'Bearer');
  }
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.status(status).json({ error: { code, message } });
}

module.exports = { notFoundHandler, errorHandler };
