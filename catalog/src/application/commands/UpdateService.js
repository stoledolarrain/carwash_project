const ServiceName = require('../../domain/value-objects/ServiceName');
const { DuplicateServiceNameError, InvalidRequestError } = require('../errors/ApplicationErrors');
const { assertObject, getExistingService } = require('../support/requestValidation');
const { persistAndPublish } = require('../support/persistAndPublish');

/** Command: actualiza datos generales (name, description, estimatedDuration) de un servicio. */
class UpdateService {
  constructor({ repository, eventPublisher, unitOfWork }) {
    this.deps = { repository, eventPublisher, unitOfWork };
  }

  /** @param {{id, name?, description?, estimatedDuration?}} input */
  async execute(input) {
    assertObject(input);
    const { id, name, description, estimatedDuration } = input;

    if (name === undefined && description === undefined && estimatedDuration === undefined) {
      throw new InvalidRequestError('At least one of name, description or estimatedDuration is required.');
    }

    const service = await getExistingService(this.deps.repository, id);

    // La unicidad se comprueba solo si el nombre realmente cambia (ignorando mayúsculas)
    if (name !== undefined) {
      const newName = new ServiceName(name).value;
      if (newName.toLowerCase() !== service.name.toLowerCase()) {
        const existing = await this.deps.repository.findByName(newName);
        if (existing && existing.id !== service.id) throw new DuplicateServiceNameError(newName);
      }
    }

    service.update({ name, description, estimatedDuration });
    return persistAndPublish(service, this.deps);
  }
}

module.exports = UpdateService;
