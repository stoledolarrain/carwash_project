const express = require('express');
const rutasOrdenes = require('./presentation/routes/orderRoutes');
const { cargarConfiguracionJwt } = require('./config/seguridad');
const { crearAutenticacionJwt } = require('./infrastructure/security/autenticacionJwt');

// Lanza un error al cargar si falta JWT_SECRET: el servicio no arranca sin poder autenticar.
const autenticar = crearAutenticacionJwt(cargarConfiguracionJwt());

const aplicacion = express();

aplicacion.use(express.json());

// Estado del servicio: lo consulta el API Gateway en /health/services (y Docker como healthcheck).
aplicacion.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'wash-order-service', timestamp: new Date().toISOString() });
});

// Todas las rutas de órdenes exigen un JWT válido de Identity Service.
aplicacion.use('/api/orders', autenticar, rutasOrdenes);

module.exports = aplicacion;
