const { Role } = require('../../domain/value-objects/Role');
const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail, ensureNotLastActiveAdmin, ensureNotSelf } = require('../support/userGuards');

/** Command (ADMIN): cambia el rol de un usuario. Invalida los tokens que el usuario tenía. */
class ChangeUserRole {
  constructor({ repository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ actorId: string, userId: string, role: string }} input */
  async execute({ actorId, userId, role }) {
    const newRole = new Role(role);
    ensureNotSelf(actorId, userId, 'cambiar el rol de');

    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;
    if (!newRole.isAdmin()) {
      await ensureNotLastActiveAdmin(this.repository, user);
    }

    user.changeRole(newRole, this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = ChangeUserRole;
