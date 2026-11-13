'use strict';

const InMemoryServiceRepository = require('../../helpers/InMemoryServiceRepository');
const FakeEventPublisher = require('../../helpers/FakeEventPublisher');
const CreateService = require('../../../src/application/commands/CreateService');
const DeactivateService = require('../../../src/application/commands/DeactivateService');
const GetActiveServices = require('../../../src/application/queries/GetActiveServices');
const GetAllServices = require('../../../src/application/queries/GetAllServices');
const GetServiceById = require('../../../src/application/queries/GetServiceById');
const GetServicesByIds = require('../../../src/application/queries/GetServicesByIds');
const { InvalidRequestError, ServiceNotFoundError } = require('../../../src/application/errors/ApplicationErrors');

const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const MISSING_ID_2 = '88888888-8888-4888-8888-888888888888';

let repository;
let eventPublisher;
let wash, wax, polish;

beforeEach(async () => {
  repository = new InMemoryServiceRepository();
  eventPublisher = new FakeEventPublisher();
  const create = new CreateService({ repository, eventPublisher });

  wash = await create.execute({ name: 'Lavado', price: 50, estimatedDuration: 30 });
  wax = await create.execute({ name: 'Encerado', price: 35.5, estimatedDuration: 20 });
  polish = await create.execute({ name: 'Pulido', price: 120, estimatedDuration: 90 });
  await new DeactivateService({ repository, eventPublisher }).execute({ id: polish.id });
  eventPublisher.published.length = 0;
});

describe('GetActiveServices', () => {
  it('devuelve solo servicios activos', async () => {
    const result = await new GetActiveServices({ repository }).execute();

    expect(result.total).toBe(2);
    expect(result.items.map((s) => s.name)).toEqual(['Encerado', 'Lavado']);
    expect(result.items.every((s) => s.isActive)).toBe(true);
  });

  it('permite paginación con page y pageSize', async () => {
    const result = await new GetActiveServices({ repository }).execute({ page: 1, pageSize: 1 });

    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(result.items.map((s) => s.name)).toEqual(['Encerado']);
  });

  it('rechaza parámetros de paginación inválidos', async () => {
    const query = new GetActiveServices({ repository });

    await expect(query.execute({ page: 0 })).rejects.toThrow(InvalidRequestError);
    await expect(query.execute({ pageSize: 0 })).rejects.toThrow(InvalidRequestError);
    await expect(query.execute({ pageSize: 101 })).rejects.toThrow(InvalidRequestError);
  });

  it('devuelve lista vacía si no hay servicios activos', async () => {
    const empty = new InMemoryServiceRepository();

    expect(await new GetActiveServices({ repository: empty }).execute()).toEqual({ items: [], total: 0 });
  });
});

describe('GetAllServices', () => {
  it('devuelve todos, incluyendo inactivos', async () => {
    const result = await new GetAllServices({ repository }).execute();

    expect(result.total).toBe(3);
    expect(result.items.find((s) => s.id === polish.id).isActive).toBe(false);
  });

  it('filtra por isActive y pagina resultados', async () => {
    const inactive = await new GetAllServices({ repository }).execute({ isActive: false, page: 1, pageSize: 10 });

    expect(inactive).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(inactive.items[0].id).toBe(polish.id);
    await expect(new GetAllServices({ repository }).execute({ isActive: 'no' })).rejects.toThrow(InvalidRequestError);
  });
});

describe('GetServiceById', () => {
  it('devuelve el servicio como DTO simple', async () => {
    const result = await new GetServiceById({ repository }).execute({ id: wash.id });

    expect(result).toEqual(wash);
    expect(result.constructor).toBe(Object);
  });

  it('devuelve también un servicio inactivo', async () => {
    const result = await new GetServiceById({ repository }).execute({ id: polish.id });

    expect(result.isActive).toBe(false);
  });

  it('lanza ServiceNotFoundError si no existe', async () => {
    await expect(new GetServiceById({ repository }).execute({ id: MISSING_ID })).rejects.toThrow(ServiceNotFoundError);
  });

  it('rechaza un id con formato inválido o ausente', async () => {
    await expect(new GetServiceById({ repository }).execute({ id: 'xyz' })).rejects.toThrow(InvalidRequestError);
    await expect(new GetServiceById({ repository }).execute()).rejects.toThrow(InvalidRequestError);
  });
});

describe('GetServicesByIds', () => {
  it('devuelve precios, moneda, duración y estado, incluidos los inactivos', async () => {
    const result = await new GetServicesByIds({ repository }).execute({ ids: [wash.id, polish.id] });

    expect(result.notFound).toEqual([]);
    expect(result.services).toHaveLength(2);
    expect(result.services[0]).toMatchObject({ id: wash.id, price: 50, currency: 'BOB', estimatedDuration: 30, isActive: true });
    expect(result.services[1]).toMatchObject({ id: polish.id, price: 120, estimatedDuration: 90, isActive: false });
  });

  it('identifica los ids inexistentes en notFound', async () => {
    const result = await new GetServicesByIds({ repository }).execute({ ids: [wax.id, MISSING_ID, MISSING_ID_2] });

    expect(result.services.map((s) => s.id)).toEqual([wax.id]);
    expect(result.notFound).toEqual([MISSING_ID, MISSING_ID_2]);
  });

  it('respeta el orden pedido y elimina ids repetidos', async () => {
    const result = await new GetServicesByIds({ repository }).execute({ ids: [wax.id, wash.id, wax.id] });

    expect(result.services.map((s) => s.id)).toEqual([wax.id, wash.id]);
  });

  it('rechaza ids ausentes, vacíos o con formato inválido', async () => {
    const query = new GetServicesByIds({ repository });

    await expect(query.execute()).rejects.toThrow(InvalidRequestError);
    await expect(query.execute({ ids: [] })).rejects.toThrow(InvalidRequestError);
    await expect(query.execute({ ids: 'x' })).rejects.toThrow(InvalidRequestError);
    await expect(query.execute({ ids: [wash.id, 'no-uuid'] })).rejects.toThrow(InvalidRequestError);
  });
});

describe('CQRS', () => {
  it('las queries no guardan ni publican eventos', async () => {
    const before = repository.saveCount;

    await new GetActiveServices({ repository }).execute();
    await new GetAllServices({ repository }).execute();
    await new GetServiceById({ repository }).execute({ id: wash.id });
    await new GetServicesByIds({ repository }).execute({ ids: [wash.id] });

    expect(repository.saveCount).toBe(before);
    expect(eventPublisher.published).toHaveLength(0);
  });
});
