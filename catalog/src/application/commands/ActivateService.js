const { assertObject, getExistingService } = require('../support/requestValidation');
const { persistAndPublish } = require('../support/persistAndPublish');

/** Command: activa un servicio (el dominio rechaza si ya estaba activo). */
class ActivateService {
  constructor({ repository, eventPublisher, unitOfWork }) {
    this.deps = { repository, eventPublisher, unitOfWork };
  }

  /** @param {{id}} input */
  async execute(input) {
    assertObject(input);
    const service = await getExistingService(this.deps.repository, input.id);

    service.activate();
    return persistAndPublish(service, this.deps);
  }
}

module.exports = ActivateService;
