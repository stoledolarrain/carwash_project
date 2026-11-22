const bcrypt = require('bcryptjs');
const PasswordHasher = require('../../application/ports/PasswordHasher');

/**
 * Implementación con bcryptjs (JavaScript puro): no necesita compilar binarios nativos,
 * lo que evita problemas en Windows y en imágenes Docker livianas.
 */
class BcryptPasswordHasher extends PasswordHasher {
  constructor({ rounds = 10 } = {}) {
    super();
    this.rounds = rounds;
  }

  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, this.rounds);
  }

  async compare(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}

module.exports = BcryptPasswordHasher;
