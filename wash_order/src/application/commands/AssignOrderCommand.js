const { EVENTOS } = require('../../domain/events/OrderEvents');

class AssignOrderCommand {
  constructor(repositorioOrdenes, emisorEventos) {
    this.repositorioOrdenes = repositorioOrdenes;
    this.emisorEventos = emisorEventos;
  }

  async ejecutar({ id, responsableId }) {
    const orden = await this.repositorioOrdenes.findById(id);

    if (!orden) {
      throw new Error(`No se encontró la orden con ID ${id}.`);
    }

    orden.asignarResponsable(responsableId);

    await this.repositorioOrdenes.save(orden);

    this.emisorEventos.emitir(EVENTOS.WASH_STARTED, {
      id: orden.id,
      placaVehiculo: orden.placaVehiculo,
      responsableId: orden.responsableId,
      estado: orden.estado
    });

    return orden;
  }
}

module.exports = AssignOrderCommand;
