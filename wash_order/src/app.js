const express = require('express');
const rutasOrdenes = require('./presentation/routes/orderRoutes');

const aplicacion = express();

aplicacion.use(express.json());
aplicacion.use('/api/orders', rutasOrdenes);

module.exports = aplicacion;
