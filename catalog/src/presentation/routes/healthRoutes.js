const { Router } = require('express');

function createHealthRouter() {
  const router = Router();

  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'catalog-service',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

module.exports = { createHealthRouter };
