const { DomainError } = require('../../domain/errors/DomainErrors');
const { ApplicationError, ERROR_KINDS } = require('../../application/errors/ApplicationErrors');

const STATUS_BY_KIND = Object.freeze({
  [ERROR_KINDS.VALIDATION]: 400,
  [ERROR_KINDS.UNAUTHENTICATED]: 401,
  [ERROR_KINDS.FORBIDDEN]: 403,
  [ERROR_KINDS.NOT_FOUND]: 404,
  [ERROR_KINDS.CONFLICT]: 409
});

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

function resolveHttpMapping(err) {
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido.' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la petición es demasiado grande.' };
  }
  if (err instanceof ApplicationError) {
    return {
      status: STATUS_BY_KIND[err.kind] || 400,
      code: err.code || 'APPLICATION_ERROR',
      message: err.message,
      details: Array.isArray(err.details) && err.details.length > 0 ? err.details : undefined
    };
  }
  if (err instanceof DomainError) {
    return { status: 400, code: err.code || 'VALIDATION_ERROR', message: err.message };
  }
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return { status: err.status, code: err.code || 'REQUEST_ERROR', message: err.message };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' };
}

/** Formato uniforme de error, igual que Catalog Service: `{ error: { code, message, details? } }`. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = resolveHttpMapping(err);

  if (mapped.status >= 500) {
    // Solo el mensaje: nunca trazas ni datos del cliente en la respuesta.
    console.error(`[ERROR] ${req.id || '-'}`, err && err.message ? err.message : err);
  }
  if (mapped.status === 401) {
    res.set('WWW-Authenticate', 'Bearer');
  }

  const payload = { code: mapped.code, message: mapped.message };
  if (mapped.details) {
    payload.details = mapped.details;
  }
  res.status(mapped.status).json({ error: payload });
}

module.exports = { notFoundHandler, errorHandler };
