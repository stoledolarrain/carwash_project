const PlainPassword = require('../../domain/value-objects/PlainPassword');
const { IncorrectCurrentPasswordError, InvalidRequestError } = require('../errors/ApplicationErrors');
const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail } = require('../support/userGuards');

/**
 * Command: el usuario autenticado cambia su contraseña.
 * Al terminar, todos sus tokens anteriores quedan revocados y debe iniciar sesión otra vez.
 */
class ChangeOwnPassword {
  constructor({ repository, passwordHasher, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.passwordHasher = passwordHasher;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ userId: string, currentPassword: string, newPassword: string }} input */
  async execute({ userId, currentPassword, newPassword }) {
    const newPlain = new PlainPassword(newPassword);
    if (currentPassword === newPassword) {
      throw new InvalidRequestError('La nueva contraseña debe ser distinta de la actual.', [
        { field: 'newPassword', message: 'Debe ser distinta de la contraseña actual.' }
      ]);
    }

    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;
    const matches = await this.passwordHasher.compare(String(currentPassword ?? ''), user.passwordHash);
    if (!matches) {
      throw new IncorrectCurrentPasswordError();
    }

    user.changePasswordHash(await this.passwordHasher.hash(newPlain.value), this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = ChangeOwnPassword;
