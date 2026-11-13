const { InvalidPriceError, InvalidCurrencyError } = require('../errors/DomainErrors');

const DEFAULT_CURRENCY = 'BOB';
const SUPPORTED_CURRENCIES = Object.freeze([DEFAULT_CURRENCY]);

/** Importe monetario guardado en centavos enteros para evitar errores de precisión. */
class Money {
  #cents;
  #currency;

  constructor(cents, currency = DEFAULT_CURRENCY) {
    if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) {
      throw new InvalidPriceError('El precio debe expresarse en centavos enteros.');
    }
    if (cents < 0) {
      throw new InvalidPriceError('El precio no puede ser negativo.');
    }
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new InvalidCurrencyError(
        `Moneda no soportada: ${currency}. Monedas válidas: ${SUPPORTED_CURRENCIES.join(', ')}.`
      );
    }
    this.#cents = cents;
    this.#currency = currency;
    Object.freeze(this);
  }

  static get DEFAULT_CURRENCY() {
    return DEFAULT_CURRENCY;
  }

  static fromCents(cents, currency = DEFAULT_CURRENCY) {
    return new Money(cents, currency);
  }

  /** Crea un Money desde un importe decimal (por ejemplo 80.5). Admite hasta 2 decimales. */
  static fromDecimal(amount, currency = DEFAULT_CURRENCY) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new InvalidPriceError('El precio debe ser un número válido.');
    }
    if (amount < 0) {
      throw new InvalidPriceError('El precio no puede ser negativo.');
    }
    const cents = Math.round(amount * 100);
    if (Math.abs(amount * 100 - cents) > 1e-6) {
      throw new InvalidPriceError('El precio admite como máximo 2 decimales.');
    }
    return new Money(cents, currency);
  }

  get cents() {
    return this.#cents;
  }

  get currency() {
    return this.#currency;
  }

  get amount() {
    return this.#cents / 100;
  }

  equals(other) {
    return other instanceof Money && other.cents === this.#cents && other.currency === this.#currency;
  }

  toJSON() {
    return { amount: this.amount, currency: this.#currency };
  }
}

module.exports = Money;
