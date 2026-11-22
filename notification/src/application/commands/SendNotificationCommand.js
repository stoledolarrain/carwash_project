const Notification = require('../../domain/Notification');

class SendNotificationCommand {
  constructor(notificationRepository) {
    this.notificationRepository = notificationRepository;
  }

  async execute({ orderId, customerName, customerPhone, eventType, customMessage }) {
    const message = customMessage || this.buildDefaultMessage(eventType, customerName, orderId);

    const notification = new Notification({
      orderId,
      customerName: customerName || 'Cliente',
      customerPhone: customerPhone || 'Sin teléfono',
      eventType: eventType || 'GENERAL_EVENT',
      message,
      status: 'SENT'
    });

    console.log(`📲 [SIMULACIÓN SMS/WHATSAPP] Para: ${notification.customerName} (${notification.customerPhone}) -> "${notification.message}"`);

    return await this.notificationRepository.save(notification);
  }

  buildDefaultMessage(eventType, customerName, orderId) {
    const name = customerName || 'estimado cliente';
    switch (eventType) {
      case 'WashOrderCreated':
        return `Hola ${name}, recibimos tu vehículo en WashFlow. Tu orden es ${orderId}.`;
      case 'WashStarted':
        return `Hola ${name}, ¡ya empezamos a lavar tu vehículo! (Orden ${orderId}).`;
      case 'WashCompleted':
        return `Hola ${name}, tu vehículo ya está listo y reluciente para retirar (Orden ${orderId}).`;
      case 'PaymentRegistered':
        return `Gracias ${name}, hemos registrado el pago de tu orden ${orderId}.`;
      default:
        return `Actualización sobre tu orden ${orderId} en WashFlow.`;
    }
  }
}

module.exports = SendNotificationCommand;