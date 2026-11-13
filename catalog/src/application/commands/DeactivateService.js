const { assertObject, getExistingService } = require('../support/requestValidation');
const { persistAndPublish } = require('../support/persistAndPublish');

/** Command: desactiva un servicio (el dominio rechaza si ya estaba inactivo). */
class DeactivateService {
  constructor({ repository, eventPublisher, unitOfWork }) {
    this.deps = { repository, eventPublisher, unitOfWork };
  }

  /** @param {{id}} input */
  async execute(input) {
    assertObject(input);
    const service = await getExistingService(this.deps.repository, input.id);

    service.deactivate();
    return persistAndPublish(service, this.deps);
  }
}

module.exports = DeactivateService;
