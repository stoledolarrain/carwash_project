const crypto = require('node:crypto');
const EventPublisher = require('../../application/ports/EventPublisher');

const TOPIC_BY_EVENT = Object.freeze({
  UserRegistered: 'identity.user.registered',
  UserRoleChanged: 'identity.user.role-changed',
  UserProfileUpdated: 'identity.user.profile-updated',
  UserPasswordChanged: 'identity.user.password-changed',
  UserActivated: 'identity.user.activated',
  UserDeactivated: 'identity.user.deactivated'
});

function resolveTopic(eventName) {
  return TOPIC_BY_EVENT[eventName] || 'identity.user.events';
}

/** Mismo sobre (envelope) que usa Catalog Service, para que todos los consumidores lean un formato común. */
function buildEnvelope(domainEvent) {
  return {
    eventId: crypto.randomUUID(),
    evento: domainEvent.name,
    eventVersion: 1,
    fechaEmision: new Date(domainEvent.occurredAt).toISOString(),
    aggregateId: domainEvent.aggregateId,
    origen: 'identity-service',
    datos: domainEvent.payload
  };
}

/**
 * Publicador temporal: escribe los eventos en consola con su topic y sobre definitivos.
 * Cuando se integre el broker se reemplaza por un publicador Kafka sin tocar los casos de uso.
 */
class ConsoleEventPublisher extends EventPublisher {
  constructor({ logger = console, silent = false } = {}) {
    super();
    this.logger = logger;
    this.silent = silent;
  }

  async publishAll(events) {
    for (const event of events) {
      const envelope = buildEnvelope(event);
      if (!this.silent) {
        this.logger.log(`[EVENTO] ${resolveTopic(event.name)} ${JSON.stringify(envelope)}`);
      }
    }
  }
}

module.exports = { ConsoleEventPublisher, TOPIC_BY_EVENT, resolveTopic, buildEnvelope };
