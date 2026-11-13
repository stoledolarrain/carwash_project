const WashService = require('../../domain/entities/WashService');
const { DuplicateServiceNameError } = require('../errors/ApplicationErrors');
const { assertObject } = require('../support/requestValidation');
const { persistAndPublish } = require('../support/persistAndPublish');

/** Command: registra un nuevo servicio en el catálogo. */
class CreateService {
  constructor({ repository, eventPublisher, unitOfWork }) {
    this.deps = { repository, eventPublisher, unitOfWork };
  }

  /** @param {{name, description?, price, currency?, estimatedDuration}} input */
  async execute(input) {
    assertObject(input);
    const { name, description, price, currency, estimatedDuration } = input;

    // El dominio valida los datos antes de consultar el repositorio
    const service = WashService.create({ name, description, price, currency, estimatedDuration });

    if (await this.deps.repository.findByName(service.name)) {
      throw new DuplicateServiceNameError(service.name);
    }

    return persistAndPublish(service, this.deps);
  }
}

module.exports = CreateService;
