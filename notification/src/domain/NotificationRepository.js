class NotificationRepository {
  async save(notification) {
    throw new Error('Método save() no implementado');
  }

  async findAll() {
    throw new Error('Método findAll() no implementado');
  }

  async findByOrderId(orderId) {
    throw new Error('Método findByOrderId() no implementado');
  }
}

module.exports = NotificationRepository;