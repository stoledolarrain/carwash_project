const crypto = require('node:crypto');
const { WashOrder, ESTADOS_ORDEN } = require('../../domain/entities/WashOrder');
const { EVENTOS } = require('../../domain/events/OrderEvents');

class CreateOrderCommand {
  constructor(repositorioOrdenes, emisorEventos) {
    this.repositorioOrdenes = repositorioOrdenes;
    this.emisorEventos = emisorEventos;
  }

  async ejecutar({ placaVehiculo, clienteId = null, servicios, precioTotal = 0 }) {
    const nuevaOrden = new WashOrder({
      id: crypto.randomUUID(),
      placaVehiculo,
      clienteId,
      servicios,
      precioTotal,
      responsableId: null,
      estado: ESTADOS_ORDEN.EN_ESPERA,
      fechaCreacion: new Date().toISOString(),
      fechaEntrega: null
    });

    await this.repositorioOrdenes.save(nuevaOrden);

    await this.emisorEventos.emitir(
      EVENTOS.WASH_ORDER_CREATED,
      nuevaOrden.toEventPayload()
    );

    return nuevaOrden;
  }
}

module.exports = CreateOrderCommand;
