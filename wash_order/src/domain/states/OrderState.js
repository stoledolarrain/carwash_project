const ESTADOS_ORDEN = {
  EN_ESPERA: 'EN_ESPERA',
  EN_PROCESO: 'EN_PROCESO',
  LISTO: 'LISTO',
  ENTREGADO: 'ENTREGADO'
};

class OrderState {
  constructor(nombre) {
    this.nombre = nombre;
  }

  asignarResponsable() {
    throw new Error(`No se puede asignar responsable ni iniciar lavado desde el estado ${this.nombre}.`);
  }

  finalizarLavado() {
    throw new Error(`No se puede finalizar el lavado desde el estado ${this.nombre}.`);
  }

  entregarVehiculo() {
    throw new Error(`No se puede entregar el vehículo desde el estado ${this.nombre}.`);
  }
}

class EnEsperaState extends OrderState {
  constructor() {
    super(ESTADOS_ORDEN.EN_ESPERA);
  }

  asignarResponsable(orden, idResponsable) {
    if (!idResponsable || typeof idResponsable !== 'string' || !idResponsable.trim()) {
      throw new Error('El identificador del responsable es obligatorio.');
    }

    orden.responsableId = idResponsable.trim();
    orden.cambiarEstado(new EnProcesoState());
  }
}

class EnProcesoState extends OrderState {
  constructor() {
    super(ESTADOS_ORDEN.EN_PROCESO);
  }

  finalizarLavado(orden) {
    if (!orden.responsableId) {
      throw new Error('No se puede finalizar una orden sin responsable asignado.');
    }

    orden.cambiarEstado(new ListoState());
  }
}

class ListoState extends OrderState {
  constructor() {
    super(ESTADOS_ORDEN.LISTO);
  }

  entregarVehiculo(orden) {
    orden.fechaEntrega = new Date().toISOString();
    orden.cambiarEstado(new EntregadoState());
  }
}

class EntregadoState extends OrderState {
  constructor() {
    super(ESTADOS_ORDEN.ENTREGADO);
  }
}

function obtenerInstanciaEstado(nombreEstado) {
  switch (nombreEstado) {
    case ESTADOS_ORDEN.EN_ESPERA:
      return new EnEsperaState();
    case ESTADOS_ORDEN.EN_PROCESO:
      return new EnProcesoState();
    case ESTADOS_ORDEN.LISTO:
      return new ListoState();
    case ESTADOS_ORDEN.ENTREGADO:
      return new EntregadoState();
    default:
      throw new Error(`El estado ${nombreEstado} no es válido.`);
  }
}

module.exports = {
  ESTADOS_ORDEN,
  OrderState,
  EnEsperaState,
  EnProcesoState,
  ListoState,
  EntregadoState,
  obtenerInstanciaEstado
};
