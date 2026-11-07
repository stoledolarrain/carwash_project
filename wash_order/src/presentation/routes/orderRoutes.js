const express = require('express');
const SqliteWashOrderRepository = require('../../infrastructure/repositories/SqliteWashOrderRepository');
const { busEventos } = require('../../infrastructure/events/eventEmitter');
const CreateOrderCommand = require('../../application/commands/CreateOrderCommand');
const AssignOrderCommand = require('../../application/commands/AssignOrderCommand');
const CompleteOrderCommand = require('../../application/commands/CompleteOrderCommand');
const DeliverOrderCommand = require('../../application/commands/DeliverOrderCommand');
const GetOrdersSummaryQuery = require('../../application/queries/GetOrdersSummaryQuery');
const GetOrderByIdQuery = require('../../application/queries/GetOrderByIdQuery');
const GetOrdersByPlateQuery = require('../../application/queries/GetOrdersByPlateQuery');
const WashOrderController = require('../controllers/WashOrderController');

const enrutador = express.Router();

const repositorioOrdenes = new SqliteWashOrderRepository();
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

// Queries (CQRS - Lectura)
enrutador.get('/summary', controladorOrdenes.obtenerResumen);
enrutador.get('/vehicle/:placa', controladorOrdenes.obtenerHistorialPorPlaca);
enrutador.get('/', controladorOrdenes.obtenerHistorialPorPlaca);
enrutador.get('/:id', controladorOrdenes.obtenerOrdenPorId);

// Commands (CQRS - Escritura y Flujo de Estados)
enrutador.post('/', controladorOrdenes.crearOrden);
enrutador.post('/:id/start', controladorOrdenes.iniciarLavado);
enrutador.post('/:id/complete', controladorOrdenes.completarLavado);
enrutador.post('/:id/deliver', controladorOrdenes.entregarVehiculo);

module.exports = enrutador;
