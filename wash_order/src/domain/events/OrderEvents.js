const EVENTOS = {
  WASH_ORDER_CREATED: 'WashOrderCreated',
  WASH_STARTED: 'WashStarted',
  WASH_COMPLETED: 'WashCompleted',
  WASH_DELIVERED: 'WashDelivered'
};

const TOPIC_ORDENES = 'wash-order.order.events';
const ORIGEN_SERVICIO = 'wash-order-service';

module.exports = {
  EVENTOS,
  TOPIC_ORDENES,
  ORIGEN_SERVICIO
};
