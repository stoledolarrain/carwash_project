const { persistAndPublish } = require('../support/persistAndPublish');
const { loadUserOrFail } = require('../support/userGuards');

/** Command (ADMIN): reactiva una cuenta. Idempotente si ya estaba activa. */
class ActivateUser {
  constructor({ repository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  /** @param {{ userId: string }} input */
  async execute({ userId }) {
    const user = await loadUserOrFail(this.repository, userId);
    const expectedVersion = user.version;
    user.activate(this.clock());
    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher, expectedVersion });
  }
}

module.exports = ActivateUser;
