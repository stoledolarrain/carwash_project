/**
 * Eventos de dominio de Identity. Estructuras inmutables sin dependencia de ningún broker.
 * Nunca incluyen la contraseña ni su hash.
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

/** payload: id, email, fullName, role. */
class UserRegistered extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserRegistered', aggregateId, occurredAt, payload });
  }
}

/** payload: id, previousRole, newRole. */
class UserRoleChanged extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserRoleChanged', aggregateId, occurredAt, payload });
  }
}

/** payload: id, fullName. */
class UserProfileUpdated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserProfileUpdated', aggregateId, occurredAt, payload });
  }
}

/** payload: id. */
class UserPasswordChanged extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserPasswordChanged', aggregateId, occurredAt, payload });
  }
}

/** payload: id, email, role. */
class UserActivated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserActivated', aggregateId, occurredAt, payload });
  }
}

/** payload: id, email, role. Wash Order debería dejar de asignar órdenes a este usuario. */
class UserDeactivated extends DomainEvent {
  constructor(aggregateId, occurredAt, payload) {
    super({ name: 'UserDeactivated', aggregateId, occurredAt, payload });
  }
}

module.exports = {
  DomainEvent,
  UserRegistered,
  UserRoleChanged,
  UserProfileUpdated,
  UserPasswordChanged,
  UserActivated,
  UserDeactivated
};
