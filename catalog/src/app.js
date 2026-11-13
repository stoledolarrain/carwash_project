const express = require('express');
const { createHealthRouter } = require('./presentation/routes/healthRoutes');
const { notFoundHandler, errorHandler } = require('./presentation/middlewares/errorHandler');

function createApp(/* container */) {
  const app = express();

  app.use(express.json());
  app.use(createHealthRouter());

  // Las rutas del catálogo (/api/catalog) se registrarán en pasos posteriores.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
