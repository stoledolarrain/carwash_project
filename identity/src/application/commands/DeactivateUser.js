const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail, ensureNotLastActiveAdmin, ensureNotSelf } = require('../support/userGuards');

/**
 * Command (ADMIN): desactiva una cuenta en lugar de borrarla, para conservar el historial
 * (las órdenes de lavado siguen referenciando a su responsable). Idempotente si ya estaba inactiva.
 */
class DeactivateUser {
  constructor({ repository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ actorId: string, userId: string }} input */
  async execute({ actorId, userId }) {
    ensureNotSelf(actorId, userId, 'desactivar');
    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;
    await ensureNotLastActiveAdmin(this.repository, user);

    user.deactivate(this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = DeactivateUser;
