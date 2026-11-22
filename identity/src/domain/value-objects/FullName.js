const { InvalidFullNameError } = require('../errors/DomainErrors');

const MIN_LENGTH = 3;
const MAX_LENGTH = 100;

/** Value Object inmutable para el nombre visible del usuario (colapsa espacios repetidos). */
class FullName {
  #value;

  constructor(raw) {
    if (typeof raw !== 'string') {
      throw new InvalidFullNameError();
    }
    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidFullNameError();
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof FullName && other.value === this.#value;
  }

  toString() {
    return this.#value;
  }
}

module.exports = FullName;
