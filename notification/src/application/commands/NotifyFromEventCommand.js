const Notification = require('../../domain/Notification');

/**
 * Textos de los avisos por tipo de evento. Las órdenes se identifican por la placa del vehículo:
 * Customer no publica teléfonos ni correos en sus eventos, así que Notification no conoce al cliente.
 */
const PLANTILLAS = Object.freeze({
  WashOrderCreated: (e) => `Recibimos tu vehículo ${e.placa}. Tu orden ya está en la cola de lavado.`,
  WashStarted: (e) => `Comenzamos a lavar tu vehículo ${e.placa}.`,
  WashCompleted: (e) => `¡Tu vehículo ${e.placa} está listo! Ya puedes pasar a recogerlo.`,
  WashDelivered: (e) => `Entregamos tu vehículo ${e.placa}. ¡Gracias por elegir WashFlow!`,
  PaymentRegistered: (e) =>
    `Gracias ${e.customerName}, registramos tu pago de Bs ${e.monto} vía ${e.metodo}.`
});

const EVENTOS_SOPORTADOS = Object.freeze(Object.keys(PLANTILLAS));

/**
 * Command: genera (simula el envío de) un aviso a partir de un evento de dominio recibido por Kafka.
 * Es idempotente: si el mismo `eventId` llega dos veces, solo se crea una notificación.
 *
 * @param {{ eventId: string, evento: string, orderId: string, placa?: string, customerName?: string, monto?: string, metodo?: string }} evento
 * @returns {Promise<{ creada: boolean, notification: Notification | null }>}
 */
class NotifyFromEventCommand {
  constructor(notificationRepository, logger = console) {
    this.notificationRepository = notificationRepository;
    this.logger = logger;
  }

  async execute(evento) {
    const plantilla = PLANTILLAS[evento.evento];
    if (!plantilla) {
      return { creada: false, notification: null };
    }

    const notification = new Notification({
      eventId: evento.eventId,
      orderId: evento.orderId,
      customerName: evento.customerName || 'Cliente',
      customerPhone: 'Sin teléfono',
      eventType: evento.evento,
      message: plantilla(evento),
      status: 'SENT'
    });

    const guardada = await this.notificationRepository.save(notification);
    if (!guardada) {
      this.logger.log(`[NOTIFICACIÓN] Evento ${evento.eventId} ya procesado antes: se ignora el duplicado.`);
      return { creada: false, notification: null };
    }

    this.logger.log(`📲 [SIMULACIÓN SMS/WHATSAPP] Orden ${guardada.orderId} -> "${guardada.message}"`);
    return { creada: true, notification: guardada };
  }
}

module.exports = { NotifyFromEventCommand, EVENTOS_SOPORTADOS };
