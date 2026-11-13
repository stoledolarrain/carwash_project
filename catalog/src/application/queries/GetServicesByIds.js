const { toServiceDto } = require('../dtos/ServiceDto');
const { InvalidRequestError } = require('../errors/ApplicationErrors');
const { assertUuid } = require('../support/requestValidation');

/**
 * Query interna (Wash Order): devuelve servicios activos e inactivos para los ids pedidos,
 * junto con `notFound`. El estado `isActive` permite al consumidor rechazar los inactivos.
 */
class GetServicesByIds {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{ids: string[]}} input */
  async execute({ ids } = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new InvalidRequestError('ids must be a non-empty array of UUIDs.');
    }
    ids.forEach((id) => assertUuid(id));

    // Sin duplicados, respetando el orden solicitado
    const requestedIds = [...new Set(ids.map((id) => id.toLowerCase()))];
    const found = await this.repository.findByIds(requestedIds);

    const byId = new Map(found.map((service) => [service.id.toLowerCase(), service]));
    const services = requestedIds.filter((id) => byId.has(id)).map((id) => toServiceDto(byId.get(id)));
    const notFound = requestedIds.filter((id) => !byId.has(id));

    return { services, notFound };
  }
}

module.exports = GetServicesByIds;
