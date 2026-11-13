const { toServiceDto } = require('../dtos/ServiceDto');

/**
 * Guarda el servicio y registra sus eventos pendientes de manera atómica.
 *
 * - Con `unitOfWork` (cableado de producción): `serviceRepository.save` y `outboxRepository.saveAll`
 *   se ejecutan en la misma transacción PostgreSQL (`BEGIN` ... `COMMIT` / `ROLLBACK`).
 * - Sin `unitOfWork`: delega en `repository.saveWithOutbox` si existe, o en `repository.save`
 *   (dobles de prueba en memoria).
 * - `eventPublisher` es un gancho opcional posterior al commit usado por las pruebas unitarias.
 *   En producción el contenedor lo deja en `null`: la publicación a Kafka la hace únicamente
 *   `OutboxWorker` leyendo `outbox_events`.
 *
 * Si no hay eventos pendientes (la operación no produjo cambios reales), no guarda ni registra nada.
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
  } else if (typeof repository.saveWithOutbox === 'function') {
    await repository.saveWithOutbox(service, events);
  } else {
    await repository.save(service);
  }

  if (eventPublisher) {
    await eventPublisher.publishAll(events);
  }
  return toServiceDto(service);
}

module.exports = { persistAndPublish };
