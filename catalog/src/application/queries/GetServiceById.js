const { toServiceDto } = require('../dtos/ServiceDto');
const { getExistingService } = require('../support/requestValidation');

/** Query: un servicio por id (activo o inactivo). */
class GetServiceById {
  constructor({ repository }) {
    this.repository = repository;
  }

  /** @param {{id}} input */
  async execute({ id } = {}) {
    return toServiceDto(await getExistingService(this.repository, id));
  }
}

module.exports = GetServiceById;
