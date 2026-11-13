const { assertObject, getExistingService } = require('../support/requestValidation');
const { persistAndPublish } = require('../support/persistAndPublish');

/** Command: cambia el precio de un servicio. */
class ChangeServicePrice {
  constructor({ repository, eventPublisher, unitOfWork }) {
    this.deps = { repository, eventPublisher, unitOfWork };
  }

  /** @param {{id, price, currency?}} input */
  async execute(input) {
    assertObject(input);
    const service = await getExistingService(this.deps.repository, input.id);

    service.changePrice(input.price, input.currency);
    return persistAndPublish(service, this.deps);
  }
}

module.exports = ChangeServicePrice;
