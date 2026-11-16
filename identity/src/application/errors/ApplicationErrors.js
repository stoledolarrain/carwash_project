/**
 * Errores de la capa de aplicación. `kind` describe la categoría del fallo sin depender de HTTP;
 * la capa de presentación decide el código de estado.
 */
const ERROR_KINDS = Object.freeze({
  VALIDATION: 'VALIDATION',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT'
});

class ApplicationError extends Error {
  constructor(message, { code, kind, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.kind = kind;
    if (details) {
      this.details = details;
    }
  }
}

class InvalidRequestError extends ApplicationError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', kind: ERROR_KINDS.VALIDATION, details });
  }
}

class UserNotFoundError extends ApplicationError {
  constructor(id) {
    super(`No existe un usuario con id ${id}.`, { code: 'USER_NOT_FOUND', kind: ERROR_KINDS.NOT_FOUND });
  }
}

class EmailAlreadyRegisteredError extends ApplicationError {
  constructor(email) {
    super(`Ya existe un usuario registrado con el correo ${email}.`, {
      code: 'EMAIL_ALREADY_REGISTERED',
      kind: ERROR_KINDS.CONFLICT
    });
  }
}

/** Mensaje genérico a propósito: no revela si el correo existe. */
class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super('Correo o contraseña incorrectos.', {
      code: 'INVALID_CREDENTIALS',
      kind: ERROR_KINDS.UNAUTHENTICATED
    });
  }
}

class AccountDisabledError extends ApplicationError {
  constructor() {
    super('La cuenta está desactivada. Contacte a un administrador.', {
      code: 'ACCOUNT_DISABLED',
      kind: ERROR_KINDS.FORBIDDEN
    });
  }
}

class InvalidTokenError extends ApplicationError {
  constructor(message = 'El token de acceso es inválido, expiró o fue revocado.') {
    super(message, { code: 'INVALID_TOKEN', kind: ERROR_KINDS.UNAUTHENTICATED });
  }
}

class IncorrectCurrentPasswordError extends ApplicationError {
  constructor() {
    super('La contraseña actual no es correcta.', {
      code: 'INCORRECT_CURRENT_PASSWORD',
      kind: ERROR_KINDS.VALIDATION
    });
  }
}

/** Operaciones que el negocio prohíbe aunque el actor sea administrador (p. ej. desactivarse a sí mismo). */
class ForbiddenOperationError extends ApplicationError {
  constructor(message) {
    super(message, { code: 'FORBIDDEN_OPERATION', kind: ERROR_KINDS.FORBIDDEN });
  }
}

class LastAdminError extends ApplicationError {
  constructor() {
    super('No se puede quitar el rol ni desactivar al último administrador activo.', {
      code: 'LAST_ADMIN',
      kind: ERROR_KINDS.CONFLICT
    });
  }
}

class ConcurrencyConflictError extends ApplicationError {
  constructor(id) {
    super(`El usuario ${id} fue modificado por otra operación. Vuelva a consultarlo e intente de nuevo.`, {
      code: 'CONCURRENCY_CONFLICT',
      kind: ERROR_KINDS.CONFLICT
    });
  }
}

module.exports = {
  ERROR_KINDS,
  ApplicationError,
  InvalidRequestError,
  UserNotFoundError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountDisabledError,
  InvalidTokenError,
  IncorrectCurrentPasswordError,
  ForbiddenOperationError,
  LastAdminError,
  ConcurrencyConflictError
};
