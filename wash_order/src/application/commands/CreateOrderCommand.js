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

    this.emisorEventos.emitir(EVENTOS.WASH_ORDER_CREATED, {
      id: nuevaOrden.id,
      placaVehiculo: nuevaOrden.placaVehiculo,
      clienteId: nuevaOrden.clienteId,
      servicios: nuevaOrden.servicios,
      precioTotal: nuevaOrden.precioTotal,
      estado: nuevaOrden.estado,
      fechaCreacion: nuevaOrden.fechaCreacion
    });

    return nuevaOrden;
  }
}

module.exports = CreateOrderCommand;
