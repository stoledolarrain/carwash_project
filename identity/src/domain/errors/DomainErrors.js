/**
 * Errores de dominio de Identity. No conocen HTTP: la capa de presentación los traduce a códigos de estado.
 */
class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class InvalidEmailError extends DomainError {
  constructor(message = 'El correo electrónico no tiene un formato válido.') {
    super(message, 'INVALID_EMAIL');
  }
}

class InvalidFullNameError extends DomainError {
  constructor(message = 'El nombre completo debe tener entre 3 y 100 caracteres.') {
    super(message, 'INVALID_FULL_NAME');
  }
}

class InvalidRoleError extends DomainError {
  constructor(role) {
    super(`El rol "${role}" no existe. Roles válidos: ADMIN, RECEPTIONIST, WASHER.`, 'INVALID_ROLE');
  }
}

class WeakPasswordError extends DomainError {
  constructor(message = 'La contraseña debe tener entre 8 y 72 caracteres e incluir letras y números.') {
    super(message, 'WEAK_PASSWORD');
  }
}

module.exports = {
  DomainError,
  InvalidEmailError,
  InvalidFullNameError,
  InvalidRoleError,
  WeakPasswordError
};
