'use strict';

const InMemoryServiceRepository = require('../../helpers/InMemoryServiceRepository');
const FakeEventPublisher = require('../../helpers/FakeEventPublisher');
const CreateService = require('../../../src/application/commands/CreateService');
const UpdateService = require('../../../src/application/commands/UpdateService');
const ChangeServicePrice = require('../../../src/application/commands/ChangeServicePrice');
const ActivateService = require('../../../src/application/commands/ActivateService');
const DeactivateService = require('../../../src/application/commands/DeactivateService');
const {
  InvalidRequestError,
  ServiceNotFoundError,
  DuplicateServiceNameError
} = require('../../../src/application/errors/ApplicationErrors');
const {
  InvalidServiceNameError,
  InvalidPriceError,
  InvalidDurationError,
  ServiceAlreadyActiveError,
  ServiceAlreadyInactiveError
} = require('../../../src/domain/errors/DomainErrors');

const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const validInput = (overrides = {}) => ({
  name: 'Lavado completo',
  description: 'Exterior e interior',
  price: 80,
  estimatedDuration: 45,
  ...overrides
});

let repository;
let eventPublisher;
let deps;

beforeEach(() => {
  repository = new InMemoryServiceRepository();
  eventPublisher = new FakeEventPublisher();
  deps = { repository, eventPublisher };
});

async function seed(overrides) {
  const created = await new CreateService(deps).execute(validInput(overrides));
  eventPublisher.published.length = 0;
  repository.saveCount = 0;
  return created;
}

describe('CreateService', () => {
  it('crea y guarda un servicio y devuelve un DTO simple', async () => {
    const result = await new CreateService(deps).execute(validInput());

    expect(result).toMatchObject({
      name: 'Lavado completo', description: 'Exterior e interior', price: 80,
      currency: 'BOB', estimatedDuration: 45, isActive: true
    });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof result.createdAt).toBe('string');
    expect(result.constructor).toBe(Object);
    expect(await repository.findById(result.id)).not.toBeNull();
  });

  it('publica ServiceCreated', async () => {
    const result = await new CreateService(deps).execute(validInput());

    expect(eventPublisher.names).toEqual(['ServiceCreated']);
    expect(eventPublisher.published[0].aggregateId).toBe(result.id);
  });

  it('rechaza un nombre duplicado ignorando mayúsculas y espacios', async () => {
    await seed();

    await expect(new CreateService(deps).execute(validInput({ name: '  LAVADO COMPLETO ' })))
      .rejects.toThrow(DuplicateServiceNameError);
    expect(repository.rows.size).toBe(1);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it.each([
    ['nombre vacío', { name: '' }, InvalidServiceNameError],
    ['nombre muy largo', { name: 'a'.repeat(101) }, InvalidServiceNameError],
    ['precio negativo', { price: -1 }, InvalidPriceError],
    ['duración cero', { estimatedDuration: 0 }, InvalidDurationError]
  ])('propaga el error de dominio con %s sin guardar ni publicar', async (_, override, ErrorClass) => {
    await expect(new CreateService(deps).execute(validInput(override))).rejects.toThrow(ErrorClass);
    expect(repository.saveCount).toBe(0);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('rechaza una petición que no es un objeto', async () => {
    await expect(new CreateService(deps).execute(null)).rejects.toThrow(InvalidRequestError);
  });

  it('no publica si el guardado falla', async () => {
    repository.save = async () => { throw new Error('db down'); };

    await expect(new CreateService(deps).execute(validInput())).rejects.toThrow('db down');
    expect(eventPublisher.published).toHaveLength(0);
  });
});

describe('UpdateService', () => {
  it('actualiza datos generales, guarda y publica ServiceUpdated', async () => {
    const { id } = await seed();

    const result = await new UpdateService(deps).execute({
      id, name: 'Lavado premium', description: 'Con cera', estimatedDuration: 60
    });

    expect(result).toMatchObject({ id, name: 'Lavado premium', description: 'Con cera', estimatedDuration: 60, price: 80 });
    expect((await repository.findById(id)).name).toBe('Lavado premium');
    expect(eventPublisher.names).toEqual(['ServiceUpdated']);
  });

  it('permite conservar el mismo nombre cambiando solo su capitalización', async () => {
    const { id } = await seed();

    const result = await new UpdateService(deps).execute({ id, name: 'LAVADO COMPLETO' });

    expect(result.name).toBe('LAVADO COMPLETO');
  });

  it('rechaza renombrar a un nombre de otro servicio', async () => {
    await seed({ name: 'Encerado' });
    const { id } = await seed();

    await expect(new UpdateService(deps).execute({ id, name: 'encerado' }))
      .rejects.toThrow(DuplicateServiceNameError);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('lanza ServiceNotFoundError si el id no existe', async () => {
    await expect(new UpdateService(deps).execute({ id: MISSING_ID, name: 'X' }))
      .rejects.toThrow(ServiceNotFoundError);
  });

  it('rechaza un id con formato inválido y una petición sin campos a actualizar', async () => {
    const { id } = await seed();

    await expect(new UpdateService(deps).execute({ id: 'abc', name: 'X' })).rejects.toThrow(InvalidRequestError);
    await expect(new UpdateService(deps).execute({ id })).rejects.toThrow(InvalidRequestError);
  });

  it('propaga errores de dominio sin guardar ni publicar', async () => {
    const { id } = await seed();

    await expect(new UpdateService(deps).execute({ id, estimatedDuration: -5 })).rejects.toThrow(InvalidDurationError);
    await expect(new UpdateService(deps).execute({ id, name: '   ' })).rejects.toThrow(InvalidServiceNameError);
    expect(repository.saveCount).toBe(0);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('no guarda ni publica si no hay cambios reales', async () => {
    const { id } = await seed();

    const result = await new UpdateService(deps).execute({ id, name: 'Lavado completo', estimatedDuration: 45 });

    expect(result.id).toBe(id);
    expect(repository.saveCount).toBe(0);
    expect(eventPublisher.published).toHaveLength(0);
  });
});

describe('ChangeServicePrice', () => {
  it('cambia el precio, guarda y publica ServicePriceChanged con precio anterior y nuevo', async () => {
    const { id } = await seed();

    const result = await new ChangeServicePrice(deps).execute({ id, price: 95.5 });

    expect(result.price).toBe(95.5);
    expect((await repository.findById(id)).priceCents).toBe(9550);
    expect(eventPublisher.names).toEqual(['ServicePriceChanged']);
    expect(eventPublisher.published[0].payload).toMatchObject({ previousPrice: 80, newPrice: 95.5, currency: 'BOB' });
  });

  it('rechaza precios negativos sin guardar ni publicar', async () => {
    const { id } = await seed();

    await expect(new ChangeServicePrice(deps).execute({ id, price: -1 })).rejects.toThrow(InvalidPriceError);
    expect((await repository.findById(id)).price).toBe(80);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('no guarda ni publica si el precio no cambia', async () => {
    const { id } = await seed();

    await new ChangeServicePrice(deps).execute({ id, price: 80 });

    expect(repository.saveCount).toBe(0);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('lanza ServiceNotFoundError si el id no existe', async () => {
    await expect(new ChangeServicePrice(deps).execute({ id: MISSING_ID, price: 10 }))
      .rejects.toThrow(ServiceNotFoundError);
  });
});

describe('DeactivateService / ActivateService', () => {
  it('desactiva un servicio activo y publica ServiceDeactivated', async () => {
    const { id } = await seed();

    const result = await new DeactivateService(deps).execute({ id });

    expect(result.isActive).toBe(false);
    expect((await repository.findById(id)).isActive).toBe(false);
    expect(eventPublisher.names).toEqual(['ServiceDeactivated']);
  });

  it('activa un servicio inactivo y publica ServiceActivated', async () => {
    const { id } = await seed();
    await new DeactivateService(deps).execute({ id });
    eventPublisher.published.length = 0;

    const result = await new ActivateService(deps).execute({ id });

    expect(result.isActive).toBe(true);
    expect(eventPublisher.names).toEqual(['ServiceActivated']);
  });

  it('propaga ServiceAlreadyActiveError sin publicar', async () => {
    const { id } = await seed();

    await expect(new ActivateService(deps).execute({ id })).rejects.toThrow(ServiceAlreadyActiveError);
    expect(repository.saveCount).toBe(0);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('propaga ServiceAlreadyInactiveError sin publicar', async () => {
    const { id } = await seed();
    await new DeactivateService(deps).execute({ id });
    eventPublisher.published.length = 0;

    await expect(new DeactivateService(deps).execute({ id })).rejects.toThrow(ServiceAlreadyInactiveError);
    expect(eventPublisher.published).toHaveLength(0);
  });

  it('lanza ServiceNotFoundError si el id no existe', async () => {
    await expect(new ActivateService(deps).execute({ id: MISSING_ID })).rejects.toThrow(ServiceNotFoundError);
    await expect(new DeactivateService(deps).execute({ id: MISSING_ID })).rejects.toThrow(ServiceNotFoundError);
  });
});

describe('Fallo del publicador', () => {
  it('propaga el error (el servicio ya quedó guardado)', async () => {
    eventPublisher.failWith = new Error('kafka down');

    await expect(new CreateService(deps).execute(validInput())).rejects.toThrow('kafka down');
    expect(repository.rows.size).toBe(1);
  });
});
