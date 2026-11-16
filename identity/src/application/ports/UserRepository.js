/**
 * Puerto de persistencia de usuarios. Hoy lo implementa `InMemoryUserRepository`;
 * en la fase de base de datos lo implementará un repositorio PostgreSQL sin cambiar los casos de uso.
 */
class UserRepository {
  /** @param {string} id @returns {Promise<import('../../domain/entities/User') | null>} */
  async findById(id) {
    throw new Error('UserRepository.findById not implemented');
  }

  /** @param {string} email ya normalizado en minúsculas @returns {Promise<import('../../domain/entities/User') | null>} */
  async findByEmail(email) {
    throw new Error('UserRepository.findByEmail not implemented');
  }

  /**
   * Inserta o actualiza. Si el usuario ya existía y su versión guardada no coincide con la esperada,
   * debe lanzar `ConcurrencyConflictError`.
   * @param {import('../../domain/entities/User')} user
   * @param {{ expectedVersion?: number | null }} [options]
   */
  async save(user, options) {
    throw new Error('UserRepository.save not implemented');
  }

  /**
   * @param {{ role?: string, isActive?: boolean, search?: string, page: number, pageSize: number }} filter
   * @returns {Promise<{ items: import('../../domain/entities/User')[], total: number }>}
   */
  async findAll(filter) {
    throw new Error('UserRepository.findAll not implemented');
  }

  /** @returns {Promise<number>} */
  async count() {
    throw new Error('UserRepository.count not implemented');
  }

  /** @returns {Promise<number>} */
  async countActiveAdmins() {
    throw new Error('UserRepository.countActiveAdmins not implemented');
  }
}

module.exports = UserRepository;
