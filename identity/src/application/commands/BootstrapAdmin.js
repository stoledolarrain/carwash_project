const { ROLES } = require('../../domain/value-objects/Role');

/**
 * Command de arranque: crea el primer administrador SOLO si todavía no existe ningún usuario.
 * Resuelve el problema del huevo y la gallina: sin registro público, alguien debe poder entrar la primera vez.
 */
class BootstrapAdmin {
  constructor({ repository, registerUser }) {
    this.repository = repository;
    this.registerUser = registerUser;
  }

  /** @param {{ email?: string, password?: string, fullName?: string }} input */
  async execute({ email, password, fullName = 'Administrador General' }) {
    if ((await this.repository.count()) > 0) {
      return { created: false, reason: 'Ya existen usuarios registrados.' };
    }
    if (!email || !password) {
      return { created: false, reason: 'ADMIN_EMAIL y ADMIN_PASSWORD no están configurados.' };
    }
    const admin = await this.registerUser.execute({ email, password, fullName, role: ROLES.ADMIN });
    return { created: true, user: admin };
  }
}

module.exports = BootstrapAdmin;
