const express = require('express');

function createHealthRouter() {
  const router = express.Router();
  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'identity-service', timestamp: new Date().toISOString() });
  });
  return router;
}

module.exports = { createHealthRouter };
