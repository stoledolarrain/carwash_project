/**
 * Puerto de publicación de eventos de dominio.
 * Hoy lo implementa `ConsoleEventPublisher`; luego lo hará Kafka (idealmente con Transactional Outbox, como Catalog).
 */
class EventPublisher {
  /** @param {import('../../domain/events/UserEvents').DomainEvent[]} events @returns {Promise<void>} */
  async publishAll(events) {
    throw new Error('EventPublisher.publishAll not implemented');
  }
}

module.exports = EventPublisher;
