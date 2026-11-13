/**
 * Puerto de unidad de trabajo para ejecutar varias operaciones de persistencia
 * (como guardar el agregado y registrar sus eventos en el Outbox) dentro de una
 * única transacción atómica.
 */
class UnitOfWork {
  /**
   * Ejecuta `work` dentro de una transacción (`BEGIN` ... `COMMIT` / `ROLLBACK`).
   * @template T
   * @param {(txContext: { serviceRepository: ServiceRepository, outboxRepository: object }) => Promise<T>} work
   * @returns {Promise<T>}
   */
  async runInTransaction(work) {
    throw new Error('UnitOfWork.runInTransaction not implemented');
  }
}

module.exports = UnitOfWork;
