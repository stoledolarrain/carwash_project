class Notification {
  constructor({ id, orderId, customerName, customerPhone, eventType, message, status, createdAt }) {
    if (!orderId) {
      throw new Error('El ID de la orden (orderId) es obligatorio para notificar.');
    }
    if (!message) {
      throw new Error('El mensaje de la notificación no puede estar vacío.');
    }

    this.id = id || null;
    this.orderId = orderId;             // Ej: "CW-0187"
    this.customerName = customerName;   // Ej: "Andrea Rojas"
    this.customerPhone = customerPhone; // Ej: "70012345" (para simular WhatsApp/SMS)
    this.eventType = eventType;         // Ej: "WashStarted", "WashCompleted", "PaymentRegistered"
    this.message = message;             // Ej: "Hola Andrea, tu Toyota Corolla está listo."
    this.status = status || 'SENT';     // Simulación de envío exitoso
    this.createdAt = createdAt || new Date();
  }
}

module.exports = Notification;