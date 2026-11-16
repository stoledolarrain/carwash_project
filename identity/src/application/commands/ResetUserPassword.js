const PlainPassword = require('../../domain/value-objects/PlainPassword');
const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail } = require('../support/userGuards');

/**
 * Command (ADMIN): asigna una contraseña nueva a un miembro del personal que la olvidó.
 * Revoca los tokens vigentes de ese usuario.
 */
class ResetUserPassword {
  constructor({ repository, passwordHasher, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.passwordHasher = passwordHasher;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ userId: string, newPassword: string }} input */
  async execute({ userId, newPassword }) {
    const newPlain = new PlainPassword(newPassword);
    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;

    user.changePasswordHash(await this.passwordHasher.hash(newPlain.value), this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = ResetUserPassword;
