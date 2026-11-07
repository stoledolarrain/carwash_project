class WashOrderRepository {
  async save(orden) {
    throw new Error('El método save debe ser implementado.');
  }

  async findById(id) {
    throw new Error('El método findById debe ser implementado.');
  }

  async findByPlate(placaVehiculo) {
    throw new Error('El método findByPlate debe ser implementado.');
  }

  async getSummary() {
    throw new Error('El método getSummary debe ser implementado.');
  }
}

module.exports = WashOrderRepository;
