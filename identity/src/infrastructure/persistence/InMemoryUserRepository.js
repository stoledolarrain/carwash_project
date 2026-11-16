const UserRepository = require('../../application/ports/UserRepository');
const User = require('../../domain/entities/User');
const { ROLES } = require('../../domain/value-objects/Role');
const {
  ConcurrencyConflictError,
  EmailAlreadyRegisteredError
} = require('../../application/errors/ApplicationErrors');

/**
 * Implementación temporal en memoria del puerto `UserRepository`.
 * Los datos se pierden al reiniciar el servicio. Se reemplazará por un repositorio PostgreSQL.
 *
 * Guarda snapshots (copias) y no las instancias, para que un agregado modificado fuera del repositorio
 * no altere lo "persistido" sin pasar por `save`, igual que ocurrirá con una base de datos real.
 * Emula las restricciones que tendrá la tabla: correo único y control de versión optimista.
 */
class InMemoryUserRepository extends UserRepository {
  #rows = new Map();

  async findById(id) {
    const row = this.#rows.get(id);
    return row ? User.restore(row) : null;
  }

  async findByEmail(email) {
    for (const row of this.#rows.values()) {
      if (row.email === email) {
        return User.restore(row);
      }
    }
    return null;
  }

  async save(user, { expectedVersion = null } = {}) {
    const snapshot = user.toSnapshot();
    const stored = this.#rows.get(snapshot.id);

    for (const row of this.#rows.values()) {
      if (row.email === snapshot.email && row.id !== snapshot.id) {
        throw new EmailAlreadyRegisteredError(snapshot.email);
      }
    }
    if (stored && expectedVersion !== null && stored.version !== expectedVersion) {
      throw new ConcurrencyConflictError(snapshot.id);
    }

    this.#rows.set(snapshot.id, snapshot);
  }

  async findAll({ role, isActive, search, page, pageSize }) {
    const filtered = [...this.#rows.values()]
      .filter((row) => role === undefined || row.role === role)
      .filter((row) => isActive === undefined || row.isActive === isActive)
      .filter(
        (row) =>
          search === undefined || row.email.includes(search) || row.fullName.toLowerCase().includes(search)
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map((row) => User.restore(row)),
      total: filtered.length
    };
  }

  async count() {
    return this.#rows.size;
  }

  async countActiveAdmins() {
    let total = 0;
    for (const row of this.#rows.values()) {
      if (row.role === ROLES.ADMIN && row.isActive) {
        total += 1;
      }
    }
    return total;
  }
}

module.exports = InMemoryUserRepository;
