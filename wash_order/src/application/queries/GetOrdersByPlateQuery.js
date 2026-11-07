const VehiclePlate = require('../../domain/value-objects/VehiclePlate');

class GetOrdersByPlateQuery {
  constructor(repositorioOrdenes) {
    this.repositorioOrdenes = repositorioOrdenes;
  }

  async ejecutar({ placaVehiculo }) {
    const objetoPlaca = new VehiclePlate(placaVehiculo);
    return this.repositorioOrdenes.findByPlate(objetoPlaca.toString());
  }
}

module.exports = GetOrdersByPlateQuery;
