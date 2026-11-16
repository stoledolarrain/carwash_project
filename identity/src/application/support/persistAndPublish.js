const { toUserDto } = require('../dtos/UserDto');

/**
 * Único punto donde los commands guardan un usuario y publican sus eventos.
 *
 * - Si el agregado no produjo eventos (operación idempotente sin cambios), no guarda nada.
 * - `expectedVersion` es la versión leída antes de modificar; el repositorio la usa para detectar
 *   escrituras concurrentes.
 * - Con PostgreSQL esto debe pasar a un Transactional Outbox (usuario + eventos en la misma transacción).
 */
async function persistAndPublish(user, { repository, eventPublisher, expectedVersion = null }) {
  const events = user.pullDomainEvents();
  if (events.length === 0) {
    return toUserDto(user);
  }

  await repository.save(user, { expectedVersion });
  if (eventPublisher) {
    await eventPublisher.publishAll(events);
  }
  return toUserDto(user);
}

module.exports = { persistAndPublish };
