/** Error base de todas las reglas de negocio del dominio. */
class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class InvalidServiceNameError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_SERVICE_NAME');
  }
}

class InvalidPriceError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_PRICE');
  }
}

class InvalidDurationError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_DURATION');
  }
}

class InvalidCurrencyError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_CURRENCY');
  }
}

class ServiceAlreadyActiveError extends DomainError {
  constructor(serviceId) {
    super(`El servicio ${serviceId} ya está activo.`, 'SERVICE_ALREADY_ACTIVE');
  }
}

class ServiceAlreadyInactiveError extends DomainError {
  constructor(serviceId) {
    super(`El servicio ${serviceId} ya está inactivo.`, 'SERVICE_ALREADY_INACTIVE');
  }
}

class InvalidServiceError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_SERVICE');
  }
}

class InvalidDescriptionError extends DomainError {
  constructor(message) {
    super(message, 'INVALID_DESCRIPTION');
  }
}

module.exports = {
  DomainError,
  InvalidServiceNameError,
  InvalidPriceError,
  InvalidDurationError,
  InvalidCurrencyError,
  ServiceAlreadyActiveError,
  ServiceAlreadyInactiveError,
  InvalidServiceError,
  InvalidDescriptionError
};
