const VehiclePlate = require('../value-objects/VehiclePlate');
const { ESTADOS_ORDEN, obtenerInstanciaEstado } = require('../states/OrderState');

class WashOrder {
  #instanciaEstado;

  constructor({
    id,
    placaVehiculo,
    clienteId = null,
    servicios,
    precioTotal = 0,
    responsableId = null,
    estado = ESTADOS_ORDEN.EN_ESPERA,
    fechaCreacion = new Date().toISOString(),
    fechaEntrega = null
  }) {
    const objetoPlaca = new VehiclePlate(placaVehiculo);

    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new Error('Debe especificar al menos un servicio.');
    }

    if (typeof precioTotal !== 'number' || Number.isNaN(precioTotal) || precioTotal < 0) {
      throw new Error('El precio total debe ser un número mayor o igual a cero.');
    }

    this.#instanciaEstado = obtenerInstanciaEstado(estado);

    this.id = id;
    this.placaVehiculo = objetoPlaca.toString();
    this.clienteId = clienteId;
    this.servicios = servicios;
    this.precioTotal = precioTotal;
    this.responsableId = responsableId;
    this.estado = this.#instanciaEstado.nombre;
    this.fechaCreacion = fechaCreacion;
    this.fechaEntrega = fechaEntrega;
  }

  cambiarEstado(nuevoEstado) {
    this.#instanciaEstado = nuevoEstado;
    this.estado = nuevoEstado.nombre;
  }

  asignarResponsable(idResponsable) {
    this.#instanciaEstado.asignarResponsable(this, idResponsable);
  }

  finalizarLavado() {
    this.#instanciaEstado.finalizarLavado(this);
  }

  entregarVehiculo() {
    this.#instanciaEstado.entregarVehiculo(this);
  }
}

module.exports = {
  WashOrder,
  ESTADOS_ORDEN
};
