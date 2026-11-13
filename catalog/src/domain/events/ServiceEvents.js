/**
 * Eventos de dominio del catálogo. Son estructuras inmutables sin dependencia de Kafka;
 * la publicación se implementará en un paso posterior.
 */
class DomainEvent {
  constructor({ name, aggregateId, occurredAt, payload }) {
    this.name = name;
    this.aggregateId = aggregateId;
    this.occurredAt = occurredAt;
    this.payload = Object.freeze({ ...payload });
    Object.freeze(this);
  }
}

class ServiceCreated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'ServiceCreated', aggregateId, occurredAt, payload });
  }
}

/** payload: estado completo posterior al cambio + `changedFields`. */
class ServiceUpdated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'ServiceUpdated', aggregateId, occurredAt, payload });
  }
}

/** payload: id, name, previousPrice, newPrice, currency. */
class ServicePriceChanged extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'ServicePriceChanged', aggregateId, occurredAt, payload });
  }
}

class ServiceActivated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'ServiceActivated', aggregateId, occurredAt, payload });
  }
}

class ServiceDeactivated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'ServiceDeactivated', aggregateId, occurredAt, payload });
  }
}

module.exports = {
  DomainEvent,
  ServiceCreated,
  ServiceUpdated,
  ServicePriceChanged,
  ServiceActivated,
  ServiceDeactivated
};
