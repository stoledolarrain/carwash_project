const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail } = require('../support/userGuards');

/** Command (ADMIN): actualiza los datos de perfil de un usuario (por ahora, el nombre completo). */
class UpdateUserProfile {
  constructor({ repository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ userId: string, fullName: string }} input */
  async execute({ userId, fullName }) {
    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;
    user.updateProfile({ fullName }, this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = UpdateUserProfile;
