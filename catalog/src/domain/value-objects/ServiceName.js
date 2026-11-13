const { InvalidServiceNameError } = require('../errors/DomainErrors');

const MAX_LENGTH = 100;

/** Nombre de un servicio: obligatorio, sin espacios sobrantes, máximo 100 caracteres. */
class ServiceName {
  #value;

  constructor(value) {
    if (typeof value !== 'string') {
      throw new InvalidServiceNameError('El nombre del servicio es obligatorio.');
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
      throw new InvalidServiceNameError('El nombre del servicio es obligatorio.');
    }
    if (normalized.length > MAX_LENGTH) {
      throw new InvalidServiceNameError(
        `El nombre del servicio no puede superar ${MAX_LENGTH} caracteres.`
      );
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  static get MAX_LENGTH() {
    return MAX_LENGTH;
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof ServiceName && other.value === this.#value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.#value;
  }
}

module.exports = ServiceName;
