const { InvalidRequestError, ServiceNotFoundError } = require('../errors/ApplicationErrors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertObject(input, label = 'request') {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidRequestError(`The ${label} must be an object.`);
  }
}

function assertUuid(id, label = 'id') {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new InvalidRequestError(`The ${label} must be a valid UUID.`);
  }
}

/** Busca un servicio por id o lanza ServiceNotFoundError. */
async function getExistingService(repository, id) {
  assertUuid(id);
  const service = await repository.findById(id);
  if (!service) throw new ServiceNotFoundError(id);
  return service;
}

module.exports = { assertObject, assertUuid, getExistingService };
