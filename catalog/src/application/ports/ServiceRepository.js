/**
 * Puerto de persistencia del catálogo. La infraestructura lo implementará (PostgreSQL).
 * Contrato: las lecturas devuelven instancias de WashService (reconstruidas con
 * `WashService.restore()`), nunca filas ni objetos de la base de datos.
 */
class ServiceRepository {
  /** Inserta o actualiza el servicio. @param {WashService} service @returns {Promise<void>} */
  async save(service) {
    throw new Error('ServiceRepository.save not implemented');
  }

  /**
   * Guarda el servicio y sus eventos pendientes en `outbox_events` dentro de una única transacción.
   * Si se proporciona `unitOfWork`, se utiliza para coordinar la transacción.
   * @param {WashService} service
   * @param {DomainEvent[]} events
   * @returns {Promise<void>}
   */
  async saveWithOutbox(service, events) {
    throw new Error('ServiceRepository.saveWithOutbox not implemented');
  }

  /** @param {string} id @returns {Promise<WashService|null>} null si no existe */
  async findById(id) {
    throw new Error('ServiceRepository.findById not implemented');
  }

  /**
   * Busca por nombre ignorando mayúsculas y minúsculas (se usa para la unicidad del nombre).
   * @param {string} name @returns {Promise<WashService|null>}
   */
  async findByName(name) {
    throw new Error('ServiceRepository.findByName not implemented');
  }

  /**
   * Devuelve los servicios existentes (activos e inactivos) para los ids dados.
   * Los ids inexistentes simplemente no aparecen en el resultado.
   * @param {string[]} ids @returns {Promise<WashService[]>}
   */
  async findByIds(ids) {
    throw new Error('ServiceRepository.findByIds not implemented');
  }

  /**
   * Lista servicios ordenados por nombre. Con `isActive` filtra por estado; sin él devuelve todos.
   * Si se pasa `page` o `pageSize`, devuelve `{ items, total, page, pageSize }`;
   * de lo contrario devuelve `WashService[]` para mantener compatibilidad.
   * @param {{ isActive?: boolean, page?: number, pageSize?: number }} [filter]
   * @returns {Promise<WashService[] | { items: WashService[], total: number, page: number, pageSize: number }>}
   */
  async findAll(filter = {}) {
    throw new Error('ServiceRepository.findAll not implemented');
  }
}

module.exports = ServiceRepository;
