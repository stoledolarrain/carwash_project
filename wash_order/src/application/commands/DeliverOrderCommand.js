const { EVENTOS } = require('../../domain/events/OrderEvents');

class DeliverOrderCommand {
  constructor(repositorioOrdenes, emisorEventos) {
    this.repositorioOrdenes = repositorioOrdenes;
    this.emisorEventos = emisorEventos;
  }

  async ejecutar({ id }) {
    const orden = await this.repositorioOrdenes.findById(id);

    if (!orden) {
      throw new Error(`No se encontró la orden con ID ${id}.`);
    }

    orden.entregarVehiculo();

    await this.repositorioOrdenes.save(orden);

    this.emisorEventos.emitir(EVENTOS.WASH_DELIVERED, {
      id: orden.id,
      placaVehiculo: orden.placaVehiculo,
      responsableId: orden.responsableId,
      estado: orden.estado,
      fechaEntrega: orden.fechaEntrega
    });

    return orden;
  }
}

module.exports = DeliverOrderCommand;
