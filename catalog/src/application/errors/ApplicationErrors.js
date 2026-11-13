/** Errores propios de la capa Application (los de reglas de negocio están en Domain). */
class ApplicationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class InvalidRequestError extends ApplicationError {
  constructor(message) {
    super(message, 'INVALID_REQUEST');
  }
}

class ServiceNotFoundError extends ApplicationError {
  constructor(serviceId) {
    super(`No existe el servicio ${serviceId}.`, 'SERVICE_NOT_FOUND');
  }
}

class DuplicateServiceNameError extends ApplicationError {
  constructor(name) {
    super(`Ya existe un servicio con el nombre "${name}".`, 'DUPLICATE_SERVICE_NAME');
  }
}

class ConcurrencyConflictError extends ApplicationError {
  constructor(serviceId, expectedVersion) {
    super(
      `Conflicto de concurrencia al actualizar el servicio ${serviceId} (versión esperada: ${expectedVersion}).`,
      'CONCURRENCY_CONFLICT'
    );
  }
}

module.exports = {
  ApplicationError,
  InvalidRequestError,
  ServiceNotFoundError,
  DuplicateServiceNameError,
  ConcurrencyConflictError
};
