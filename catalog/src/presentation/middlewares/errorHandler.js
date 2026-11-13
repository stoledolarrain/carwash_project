const {
  DomainError,
  ServiceAlreadyActiveError,
  ServiceAlreadyInactiveError
} = require('../../domain/errors/DomainErrors');
const {
  ApplicationError,
  InvalidRequestError,
  ServiceNotFoundError,
  DuplicateServiceNameError,
  ConcurrencyConflictError
} = require('../../application/errors/ApplicationErrors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

function resolveHttpMapping(err) {
  if (err.type === 'entity.parse.failed') {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'El cuerpo de la petición no es un JSON válido.'
    };
  }

  if (err instanceof ServiceNotFoundError) {
    return { status: 404, code: err.code || 'SERVICE_NOT_FOUND', message: err.message };
  }

  if (
    err instanceof DuplicateServiceNameError ||
    err instanceof ConcurrencyConflictError ||
    err instanceof ServiceAlreadyActiveError ||
    err instanceof ServiceAlreadyInactiveError
  ) {
    return { status: 409, code: err.code || 'CONFLICT', message: err.message };
  }

  if (err instanceof InvalidRequestError || err instanceof DomainError) {
    return {
      status: 400,
      code: err.code || 'VALIDATION_ERROR',
      message: err.message,
      details: Array.isArray(err.details) && err.details.length > 0 ? err.details : undefined
    };
  }

  if (err instanceof ApplicationError) {
    const status = Number.isInteger(err.status) ? err.status : 400;
    return { status, code: err.code || 'APPLICATION_ERROR', message: err.message };
  }

  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return {
      status: err.status,
      code: err.code || 'REQUEST_ERROR',
      message: err.message
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor.'
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = resolveHttpMapping(err);

  if (mapped.status >= 500) {
    console.error('[ERROR]', err && err.message ? err.message : err);
  }

  const errorPayload = {
    code: mapped.code,
    message: mapped.message
  };

  if (mapped.details) {
    errorPayload.details = mapped.details;
  }

  res.status(mapped.status).json({ error: errorPayload });
}

module.exports = { notFoundHandler, errorHandler };
