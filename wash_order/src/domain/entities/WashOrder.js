const VehiclePlate = require('../value-objects/VehiclePlate');
const { ESTADOS_ORDEN, obtenerInstanciaEstado } = require('../states/OrderState');

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    if (clienteId !== null && clienteId !== undefined) {
      if (typeof clienteId !== 'string' || !REGEX_UUID.test(clienteId.trim())) {
        throw new Error('El identificador del cliente (clienteId) debe ser un UUID válido o null.');
      }
    }

    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new Error('Debe especificar al menos un servicio.');
    }

    if (typeof precioTotal !== 'number' || Number.isNaN(precioTotal) || precioTotal < 0) {
      throw new Error('El precio total debe ser un número mayor o igual a cero.');
    }

    this.#instanciaEstado = obtenerInstanciaEstado(estado);

    this.id = id;
    this.placaVehiculo = objetoPlaca.toString();
    this.clienteId = clienteId ? clienteId.trim() : null;
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

  toEventPayload() {
    const payload = {
      id: this.id,
      placaVehiculo: this.placaVehiculo,
      clienteId: this.clienteId,
      servicios: this.servicios,
      precioTotal: this.precioTotal,
      responsableId: this.responsableId,
      estado: this.estado,
      fechaCreacion: this.fechaCreacion
    };

    if (this.fechaEntrega) {
      payload.fechaEntrega = this.fechaEntrega;
    }

    return payload;
  }
}

module.exports = {
  WashOrder,
  ESTADOS_ORDEN
};
