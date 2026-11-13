const { Router } = require('express');
const { requireAdmin } = require('../middlewares/requireRole');

/**
 * Construye el router de `/api/catalog` conectando las rutas públicas, de lote y administrativas
 * con `CatalogController`. Express 5 captura automáticamente las promesas rechazadas en handlers async.
 */
function createCatalogRouter({ controller, adminAuthMiddleware = requireAdmin }) {
  if (!controller) {
    throw new Error('createCatalogRouter requires a CatalogController instance.');
  }

  const router = Router();

  // Endpoints públicos
  router.get('/services', (req, res) => controller.listPublicServices(req, res));
  router.get('/services/:id', (req, res) => controller.getPublicServiceById(req, res));

  // Endpoint de consulta por lote para Wash Order
  router.post('/services/batch', (req, res) => controller.getServicesBatch(req, res));

  // Endpoints administrativos (protegidos por rol ADMIN)
  const adminRouter = Router();
  adminRouter.use(adminAuthMiddleware);

  adminRouter.get('/services', (req, res) => controller.listAdminServices(req, res));
  adminRouter.post('/services', (req, res) => controller.createService(req, res));
  adminRouter.put('/services/:id', (req, res) => controller.updateService(req, res));
  adminRouter.patch('/services/:id/price', (req, res) => controller.changeServicePrice(req, res));
  adminRouter.patch('/services/:id/activate', (req, res) => controller.activateService(req, res));
  adminRouter.patch('/services/:id/deactivate', (req, res) => controller.deactivateService(req, res));

  router.use('/admin', adminRouter);

  return router;
}

module.exports = { createCatalogRouter };
