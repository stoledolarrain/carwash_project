const express = require('express');
const PostgresWashOrderRepository = require('../../infrastructure/repositories/PostgresWashOrderRepository');
const { busEventos } = require('../../infrastructure/events/eventEmitter');
const CreateOrderCommand = require('../../application/commands/CreateOrderCommand');
const AssignOrderCommand = require('../../application/commands/AssignOrderCommand');
const CompleteOrderCommand = require('../../application/commands/CompleteOrderCommand');
const DeliverOrderCommand = require('../../application/commands/DeliverOrderCommand');
const GetOrdersSummaryQuery = require('../../application/queries/GetOrdersSummaryQuery');
const GetOrderByIdQuery = require('../../application/queries/GetOrderByIdQuery');
const GetOrdersByPlateQuery = require('../../application/queries/GetOrdersByPlateQuery');
const WashOrderController = require('../controllers/WashOrderController');
const { requerirRol, ROLES } = require('../middlewares/requerirRol');

const enrutador = express.Router();

const repositorioOrdenes = new PostgresWashOrderRepository();
const createOrderCommand = new CreateOrderCommand(repositorioOrdenes, busEventos);
const assignOrderCommand = new AssignOrderCommand(repositorioOrdenes, busEventos);
const completeOrderCommand = new CompleteOrderCommand(repositorioOrdenes, busEventos);
const deliverOrderCommand = new DeliverOrderCommand(repositorioOrdenes, busEventos);
const getOrdersSummaryQuery = new GetOrdersSummaryQuery(repositorioOrdenes);
const getOrderByIdQuery = new GetOrderByIdQuery(repositorioOrdenes);
const getOrdersByPlateQuery = new GetOrdersByPlateQuery(repositorioOrdenes);

const controladorOrdenes = new WashOrderController({
  createOrderCommand,
  assignOrderCommand,
  completeOrderCommand,
  deliverOrderCommand,
  getOrdersSummaryQuery,
  getOrderByIdQuery,
  getOrdersByPlateQuery
});

// La autenticación JWT se aplica en app.js a todo /api/orders; aquí se controla el rol de cada acción.
enrutador.get('/summary', requerirRol(...ROLES.CONSULTAR), controladorOrdenes.obtenerResumen);
enrutador.get('/vehicle/:placa', requerirRol(...ROLES.CONSULTAR), controladorOrdenes.obtenerHistorialPorPlaca);
enrutador.get('/', requerirRol(...ROLES.CONSULTAR), controladorOrdenes.obtenerHistorialPorPlaca);
enrutador.get('/:id', requerirRol(...ROLES.CONSULTAR), controladorOrdenes.obtenerOrdenPorId);

enrutador.post('/', requerirRol(...ROLES.CREAR_Y_ASIGNAR), controladorOrdenes.crearOrden);
enrutador.post('/:id/start', requerirRol(...ROLES.CREAR_Y_ASIGNAR), controladorOrdenes.iniciarLavado);
enrutador.post('/:id/complete', requerirRol(...ROLES.FINALIZAR), controladorOrdenes.completarLavado);
enrutador.post('/:id/deliver', requerirRol(...ROLES.ENTREGAR), controladorOrdenes.entregarVehiculo);

module.exports = enrutador;
