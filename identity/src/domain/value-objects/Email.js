const { InvalidEmailError } = require('../errors/DomainErrors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254;

/** Value Object inmutable. Normaliza a minúsculas para que el correo sea único sin importar mayúsculas. */
class Email {
  #value;

  constructor(raw) {
    if (typeof raw !== 'string') {
      throw new InvalidEmailError();
    }
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0 || normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof Email && other.value === this.#value;
  }

  toString() {
    return this.#value;
  }
}

module.exports = Email;
