'use strict';

const ServiceRepository = require('../../../src/application/ports/ServiceRepository');
const EventPublisher = require('../../../src/application/ports/EventPublisher');
const UnitOfWork = require('../../../src/application/ports/UnitOfWork');

describe('Puertos de Application', () => {
  it('ServiceRepository exige una implementación concreta de cada operación', async () => {
    const repository = new ServiceRepository();

    await expect(repository.save({})).rejects.toThrow('not implemented');
    await expect(repository.saveWithOutbox({}, [])).rejects.toThrow('not implemented');
    await expect(repository.findById('x')).rejects.toThrow('not implemented');
    await expect(repository.findByName('x')).rejects.toThrow('not implemented');
    await expect(repository.findByIds([])).rejects.toThrow('not implemented');
    await expect(repository.findAll()).rejects.toThrow('not implemented');
  });

  it('EventPublisher exige una implementación concreta', async () => {
    await expect(new EventPublisher().publishAll([])).rejects.toThrow('not implemented');
  });

  it('UnitOfWork exige una implementación concreta', async () => {
    await expect(new UnitOfWork().runInTransaction(() => {})).rejects.toThrow('not implemented');
  });
});
