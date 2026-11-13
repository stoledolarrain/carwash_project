function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido.' }
    });
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(status).json({
    error: {
      code: status >= 500 ? 'INTERNAL_ERROR' : err.code || 'REQUEST_ERROR',
      message: status >= 500 ? 'Error interno del servidor.' : err.message
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
