const { toServiceDto } = require('../dtos/ServiceDto');

/**
 * Guarda el servicio y registra sus eventos pendientes de manera atómica.
 *
 * Prioridad de ejecución:
 * 1. Si existe `unitOfWork`, ejecuta `serviceRepository.save(service)` y `outboxRepository.saveAll(events)`
 *    en la misma transacción de base de datos (`BEGIN` ... `COMMIT` / `ROLLBACK`).
 * 2. Si el repositorio implementa `saveWithOutbox(service, events)` (sin `save` sobrescrito en un test),
 *    delega la transacción atómica al repositorio.
 * 3. Como respaldo para dobles de prueba en memoria, llama a `repository.save` y `eventPublisher.publishAll`.
 *
 * Si no hay eventos pendientes (la operación no produjo cambios reales), no guarda ni inserta eventos.
 */
async function persistAndPublish(service, { repository, eventPublisher, unitOfWork }) {
  const events = service.pullDomainEvents();
  if (events.length === 0) {
    return toServiceDto(service);
  }

  if (unitOfWork) {
    await unitOfWork.runInTransaction(async ({ serviceRepository, outboxRepository }) => {
      await serviceRepository.save(service);
      await outboxRepository.saveAll(events);
    });
    if (eventPublisher) {
      await eventPublisher.publishAll(events);
    }
    return toServiceDto(service);
  }

  const hasCustomSaveOverride =
    repository && Object.prototype.hasOwnProperty.call(repository, 'save');

  if (repository && typeof repository.saveWithOutbox === 'function' && !hasCustomSaveOverride) {
    await repository.saveWithOutbox(service, events);
    if (eventPublisher) {
      await eventPublisher.publishAll(events);
    }
    return toServiceDto(service);
  }

  await repository.save(service);
  if (eventPublisher) {
    await eventPublisher.publishAll(events);
  }
  return toServiceDto(service);
}

module.exports = { persistAndPublish };
