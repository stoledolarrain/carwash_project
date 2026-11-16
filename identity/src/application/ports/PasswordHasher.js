/**
 * Puerto para el hash de contraseñas. La infraestructura lo implementa con bcrypt.
 */
class PasswordHasher {
  /** @param {string} plainPassword @returns {Promise<string>} */
  async hash(plainPassword) {
    throw new Error('PasswordHasher.hash not implemented');
  }

  /** @param {string} plainPassword @param {string} passwordHash @returns {Promise<boolean>} */
  async compare(plainPassword, passwordHash) {
    throw new Error('PasswordHasher.compare not implemented');
  }
}

module.exports = PasswordHasher;
