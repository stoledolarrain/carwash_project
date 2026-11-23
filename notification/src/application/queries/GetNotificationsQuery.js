class GetNotificationsQuery {
  constructor(notificationRepository) {
    this.notificationRepository = notificationRepository;
  }

  async execute(orderId = null) {
    if (orderId) {
      return await this.notificationRepository.findByOrderId(orderId);
    }
    return await this.notificationRepository.findAll();
  }
}

module.exports = GetNotificationsQuery;