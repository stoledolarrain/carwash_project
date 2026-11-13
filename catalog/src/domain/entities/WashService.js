const crypto = require('node:crypto');
const ServiceName = require('../value-objects/ServiceName');
const Money = require('../value-objects/Money');
const Duration = require('../value-objects/Duration');
const {
  InvalidServiceError,
  InvalidDescriptionError,
  ServiceAlreadyActiveError,
  ServiceAlreadyInactiveError
} = require('../errors/DomainErrors');
const {
  ServiceCreated,
  ServiceUpdated,
  ServicePriceChanged,
  ServiceActivated,
  ServiceDeactivated
} = require('../events/ServiceEvents');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION_LENGTH = 500;

function normalizeDescription(description) {
  if (description === undefined || description === null) return '';
  if (typeof description !== 'string') {
    throw new InvalidDescriptionError('La descripción debe ser un texto.');
  }
  const normalized = description.trim();
  if (normalized.length > MAX_DESCRIPTION_LENGTH) {
    throw new InvalidDescriptionError(
      `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`
    );
  }
  return normalized;
}

function assertUuid(id) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new InvalidServiceError('El id del servicio debe ser un UUID válido.');
  }
}

function assertVersion(version) {
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new InvalidServiceError('La versión del servicio debe ser un entero mayor o igual a 1.');
  }
}

/**
 * Agregado raíz del catálogo. El estado es privado: solo se modifica mediante
 * sus métodos, que validan las invariantes, incrementan `version` y registran eventos de dominio.
 */
class WashService {
  #id;
  #name;
  #description;
  #price;
  #estimatedDuration;
  #isActive;
  #version;
  #createdAt;
  #updatedAt;
  #events = [];

  constructor({ id, name, description, price, estimatedDuration, isActive, version, createdAt, updatedAt }) {
    this.#id = id;
    this.#name = name;
    this.#description = description;
    this.#price = price;
    this.#estimatedDuration = estimatedDuration;
    this.#isActive = isActive;
    this.#version = version;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;
  }

  static get MAX_DESCRIPTION_LENGTH() {
    return MAX_DESCRIPTION_LENGTH;
  }

  /**
   * Factory Method: crea un servicio nuevo (activo por defecto, version = 1) y registra ServiceCreated.
   * `price` se recibe como importe decimal en BOB; `id` y `now` son opcionales (útiles en pruebas).
   */
  static create({ name, description, price, currency = Money.DEFAULT_CURRENCY, estimatedDuration, id, now = new Date() }) {
    const serviceId = id === undefined ? crypto.randomUUID() : id;
    assertUuid(serviceId);

    const service = new WashService({
      id: serviceId,
      name: new ServiceName(name),
      description: normalizeDescription(description),
      price: Money.fromDecimal(price, currency),
      estimatedDuration: new Duration(estimatedDuration),
      isActive: true,
      version: 1,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    });

    service.#record(new ServiceCreated(serviceId, new Date(now), service.#snapshot()));
    return service;
  }

  /**
   * Factory Method: reconstruye un servicio existente (por ejemplo desde la base de datos).
   * Valida los datos pero no registra eventos. `priceCents` evita conversiones decimales.
   */
  static restore({
    id,
    name,
    description,
    priceCents,
    currency = Money.DEFAULT_CURRENCY,
    estimatedDuration,
    isActive,
    version = 1,
    createdAt,
    updatedAt
  }) {
    assertUuid(id);
    if (typeof isActive !== 'boolean') {
      throw new InvalidServiceError('El estado del servicio debe ser booleano.');
    }
    assertVersion(version);
    return new WashService({
      id,
      name: new ServiceName(name),
      description: normalizeDescription(description),
      price: Money.fromCents(priceCents, currency),
      estimatedDuration: new Duration(estimatedDuration),
      isActive,
      version,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt)
    });
  }

  get id() { return this.#id; }
  get name() { return this.#name.value; }
  get description() { return this.#description; }
  get price() { return this.#price.amount; }
  get priceCents() { return this.#price.cents; }
  get currency() { return this.#price.currency; }
  get estimatedDuration() { return this.#estimatedDuration.minutes; }
  get isActive() { return this.#isActive; }
  get version() { return this.#version; }
  get createdAt() { return new Date(this.#createdAt); }
  get updatedAt() { return new Date(this.#updatedAt); }

  /**
   * Actualiza datos generales (name, description, estimatedDuration).
   * Solo cambia los campos recibidos y distintos; si no hay cambios reales no registra evento ni incrementa version.
   */
  update({ name, description, estimatedDuration } = {}, now = new Date()) {
    const changedFields = [];
    let newName = this.#name;
    let newDescription = this.#description;
    let newDuration = this.#estimatedDuration;

    if (name !== undefined) {
      newName = new ServiceName(name);
      if (!newName.equals(this.#name)) changedFields.push('name');
    }
    if (description !== undefined) {
      newDescription = normalizeDescription(description);
      if (newDescription !== this.#description) changedFields.push('description');
    }
    if (estimatedDuration !== undefined) {
      newDuration = new Duration(estimatedDuration);
      if (!newDuration.equals(this.#estimatedDuration)) changedFields.push('estimatedDuration');
    }

    if (changedFields.length === 0) return this;

    this.#name = newName;
    this.#description = newDescription;
    this.#estimatedDuration = newDuration;
    this.#version += 1;
    this.#updatedAt = new Date(now);
    this.#record(new ServiceUpdated(this.#id, new Date(now), { ...this.#snapshot(), changedFields }));
    return this;
  }

  /** Cambia el precio (importe decimal en BOB). Si es igual al actual no hace nada. */
  changePrice(newPrice, currency = this.#price.currency, now = new Date()) {
    const newMoney = Money.fromDecimal(newPrice, currency);
    if (newMoney.equals(this.#price)) return this;

    const previous = this.#price;
    this.#price = newMoney;
    this.#version += 1;
    this.#updatedAt = new Date(now);
    this.#record(
      new ServicePriceChanged(this.#id, new Date(now), {
        id: this.#id,
        name: this.#name.value,
        previousPrice: previous.amount,
        newPrice: newMoney.amount,
        currency: newMoney.currency,
        version: this.#version
      })
    );
    return this;
  }

  activate(now = new Date()) {
    if (this.#isActive) throw new ServiceAlreadyActiveError(this.#id);
    this.#isActive = true;
    this.#version += 1;
    this.#updatedAt = new Date(now);
    this.#record(
      new ServiceActivated(this.#id, new Date(now), {
        id: this.#id,
        name: this.#name.value,
        isActive: true,
        version: this.#version
      })
    );
    return this;
  }

  deactivate(now = new Date()) {
    if (!this.#isActive) throw new ServiceAlreadyInactiveError(this.#id);
    this.#isActive = false;
    this.#version += 1;
    this.#updatedAt = new Date(now);
    this.#record(
      new ServiceDeactivated(this.#id, new Date(now), {
        id: this.#id,
        name: this.#name.value,
        isActive: false,
        version: this.#version
      })
    );
    return this;
  }

  /** Devuelve y vacía los eventos pendientes (los publicará la capa de aplicación más adelante). */
  pullDomainEvents() {
    const pending = this.#events;
    this.#events = [];
    return pending;
  }

  toJSON() {
    return {
      ...this.#snapshot(),
      createdAt: this.#createdAt.toISOString(),
      updatedAt: this.#updatedAt.toISOString()
    };
  }

  #snapshot() {
    return {
      id: this.#id,
      name: this.#name.value,
      description: this.#description,
      price: this.#price.amount,
      currency: this.#price.currency,
      estimatedDuration: this.#estimatedDuration.minutes,
      isActive: this.#isActive,
      version: this.#version
    };
  }

  #record(event) {
    this.#events.push(event);
  }
}

module.exports = WashService;
