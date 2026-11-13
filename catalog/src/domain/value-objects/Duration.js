const { InvalidDurationError } = require('../errors/DomainErrors');

/** Duración estimada en minutos enteros, estrictamente mayor que cero. */
class Duration {
  #minutes;

  constructor(minutes) {
    if (typeof minutes !== 'number' || !Number.isInteger(minutes)) {
      throw new InvalidDurationError('La duración estimada debe ser un número entero de minutos.');
    }
    if (minutes <= 0) {
      throw new InvalidDurationError('La duración estimada debe ser mayor que cero.');
    }
    this.#minutes = minutes;
    Object.freeze(this);
  }

  static ofMinutes(minutes) {
    return new Duration(minutes);
  }

  get minutes() {
    return this.#minutes;
  }

  equals(other) {
    return other instanceof Duration && other.minutes === this.#minutes;
  }

  toJSON() {
    return this.#minutes;
  }
}

module.exports = Duration;
