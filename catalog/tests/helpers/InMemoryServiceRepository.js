const ServiceRepository = require('../../src/application/ports/ServiceRepository');
const WashService = require('../../src/domain/entities/WashService');
const {
  DuplicateServiceNameError,
  ConcurrencyConflictError,
  ServiceNotFoundError
} = require('../../src/application/errors/ApplicationErrors');

/**
 * Repositorio falso en memoria para pruebas. Guarda filas simples, verifica concurrencia
 * optimista (`version`), unicidad de nombre e imita `saveWithOutbox`.
 */
class InMemoryServiceRepository extends ServiceRepository {
  constructor() {
    super();
    this.rows = new Map();
    this.outbox = [];
    this.saveCount = 0;
  }

  async save(service) {
    this.saveCount += 1;

    const duplicate = [...this.rows.values()].find(
      (r) => r.id !== service.id && r.name.toLowerCase() === service.name.toLowerCase()
    );
    if (duplicate) {
      throw new DuplicateServiceNameError(service.name);
    }

    if (service.version > 1) {
      const existing = this.rows.get(service.id);
      if (!existing) {
        throw new ServiceNotFoundError(service.id);
      }
      const expectedVersion = service.version - 1;
      if (existing.version !== expectedVersion) {
        throw new ConcurrencyConflictError(service.id, expectedVersion);
      }
    }

    this.rows.set(service.id, {
      id: service.id,
      name: service.name,
      description: service.description,
      priceCents: service.priceCents,
      currency: service.currency,
      estimatedDuration: service.estimatedDuration,
      isActive: service.isActive,
      version: service.version,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    });
  }

  async saveWithOutbox(service, events = []) {
    await this.save(service);
    this.outbox.push(...events);
  }

  async findById(id) {
    const row = this.rows.get(id);
    return row ? WashService.restore(row) : null;
  }

  async findByName(name) {
    const target = name.trim().toLowerCase();
    const row = [...this.rows.values()].find((r) => r.name.toLowerCase() === target);
    return row ? WashService.restore(row) : null;
  }

  async findByIds(ids) {
    return ids.filter((id) => this.rows.has(id)).map((id) => WashService.restore(this.rows.get(id)));
  }

  async findAll({ isActive, page, pageSize } = {}) {
    const filtered = [...this.rows.values()]
      .filter((r) => isActive === undefined || r.isActive === isActive)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name))
      .map((r) => WashService.restore(r));

    if (page === undefined && pageSize === undefined) {
      return filtered;
    }

    const resolvedPage = page === undefined ? 1 : Number(page);
    const resolvedPageSize = pageSize === undefined ? 20 : Number(pageSize);
    const offset = (resolvedPage - 1) * resolvedPageSize;

    return {
      items: filtered.slice(offset, offset + resolvedPageSize),
      total: filtered.length,
      page: resolvedPage,
      pageSize: resolvedPageSize
    };
  }
}

module.exports = InMemoryServiceRepository;
