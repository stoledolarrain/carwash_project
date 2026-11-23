class NotificationController {
  constructor(sendNotificationCommand, getNotificationsQuery) {
    this.sendNotificationCommand = sendNotificationCommand;
    this.getNotificationsQuery = getNotificationsQuery;
  }

  send = async (req, res) => {
    try {
      const { orderId, customerName, customerPhone, eventType, customMessage } = req.body;
      const saved = await this.sendNotificationCommand.execute({
        orderId,
        customerName,
        customerPhone,
        eventType,
        customMessage
      });
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const { orderId } = req.query;
      const list = await this.getNotificationsQuery.execute(orderId);
      res.status(200).json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

module.exports = NotificationController;