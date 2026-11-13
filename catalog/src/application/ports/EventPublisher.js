/**
 * Puerto de publicación de eventos de dominio. La infraestructura lo implementará (Kafka/outbox).
 */
class EventPublisher {
  /** @param {DomainEvent[]} events @returns {Promise<void>} */
  async publishAll(events) {
    throw new Error('EventPublisher.publishAll not implemented');
  }
}

module.exports = EventPublisher;
