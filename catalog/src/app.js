const express = require('express');
const { buildContainer } = require('./container');
const CatalogController = require('./presentation/controllers/CatalogController');
const { createHealthRouter } = require('./presentation/routes/healthRoutes');
const { createCatalogRouter } = require('./presentation/routes/catalogRoutes');
const { notFoundHandler, errorHandler } = require('./presentation/middlewares/errorHandler');

/**
 * Crea y configura la aplicación Express 5 sin ejecutar `app.listen`.
 *
 * @param {object} [container] Contenedor de dependencias (si no se envía, se construye de forma perezosa).
 * @param {{ authContextMiddleware?: Function }} [options] Permite inyectar un middleware que establezca `req.auth`
 *   (por ejemplo, la futura integración con API Gateway / Identity Service o un contexto controlado en pruebas).
 */
function createApp(container, options = {}) {
  const resolvedContainer = container || buildContainer();
  const app = express();

  app.use(express.json());

  if (typeof options.authContextMiddleware === 'function') {
    app.use(options.authContextMiddleware);
  }

  app.use(createHealthRouter());

  const controller =
    resolvedContainer.catalogController ||
    new CatalogController({
      commands: resolvedContainer.commands,
      queries: resolvedContainer.queries
    });

  app.use('/api/catalog', createCatalogRouter({ controller }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
