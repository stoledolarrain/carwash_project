const { WeakPasswordError } = require('../errors/DomainErrors');

const MIN_LENGTH = 8;
// bcrypt solo considera los primeros 72 bytes: lo que pase de ahí se ignoraría en silencio.
const MAX_BYTES = 72;

/**
 * Política de contraseñas del negocio. Solo valida; su valor nunca se persiste, se registra ni se serializa.
 */
class PlainPassword {
  #value;

  constructor(raw) {
    if (typeof raw !== 'string' || raw.length < MIN_LENGTH || Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
      throw new WeakPasswordError();
    }
    if (!/[A-Za-z]/.test(raw) || !/\d/.test(raw)) {
      throw new WeakPasswordError();
    }
    this.#value = raw;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  toJSON() {
    return '[PROTECTED]';
  }

  toString() {
    return '[PROTECTED]';
  }
}

module.exports = PlainPassword;
