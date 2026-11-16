const { InvalidRoleError } = require('../errors/DomainErrors');

/**
 * Roles de acceso de la plataforma.
 * Los permisos sirven de referencia para que cada microservicio aplique su propia autorización.
 */
const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  WASHER: 'WASHER'
});

const ROLE_DEFINITIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze({
    descripcion: 'Administrador: gestiona usuarios, roles, catálogo, personal y reportes.',
    permisos: Object.freeze([
      'users:manage',
      'catalog:manage',
      'customers:manage',
      'orders:create',
      'orders:assign',
      'orders:change-status',
      'payments:register',
      'reports:read'
    ])
  }),
  [ROLES.RECEPTIONIST]: Object.freeze({
    descripcion: 'Recepcionista: registra clientes y vehículos, crea órdenes, asigna personal y registra pagos.',
    permisos: Object.freeze([
      'customers:manage',
      'orders:create',
      'orders:assign',
      'orders:change-status',
      'payments:register'
    ])
  }),
  [ROLES.WASHER]: Object.freeze({
    descripcion: 'Personal de lavado: consulta la cola de trabajo y actualiza el estado de sus órdenes.',
    permisos: Object.freeze(['orders:read-assigned', 'orders:change-status'])
  })
});

/** Value Object inmutable de rol. Acepta mayúsculas o minúsculas y normaliza a mayúsculas. */
class Role {
  #value;

  constructor(raw) {
    const normalized = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    if (!Object.values(ROLES).includes(normalized)) {
      throw new InvalidRoleError(raw);
    }
    this.#value = normalized;
    Object.freeze(this);
  }

  get value() {
    return this.#value;
  }

  get permissions() {
    return ROLE_DEFINITIONS[this.#value].permisos;
  }

  equals(other) {
    return other instanceof Role && other.value === this.#value;
  }

  isAdmin() {
    return this.#value === ROLES.ADMIN;
  }

  toString() {
    return this.#value;
  }
}

module.exports = { Role, ROLES, ROLE_DEFINITIONS };
