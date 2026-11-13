'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { buildContainer } = require('../../src/container');
const InMemoryServiceRepository = require('../helpers/InMemoryServiceRepository');
const FakeEventPublisher = require('../helpers/FakeEventPublisher');
const { ConcurrencyConflictError } = require('../../src/application/errors/ApplicationErrors');
const CatalogController = require('../../src/presentation/controllers/CatalogController');
const { createCatalogRouter } = require('../../src/presentation/routes/catalogRoutes');

const MISSING_ID = '99999999-9999-4999-8999-999999999999';

function createTestEnvironment({ auth } = {}) {
  const repository = new InMemoryServiceRepository();
  const eventPublisher = new FakeEventPublisher();
  const container = buildContainer({ repository, eventPublisher });

  let currentAuth = auth;
  const app = createApp(container, {
    authContextMiddleware: (req, _res, next) => {
      if (currentAuth !== undefined) {
        req.auth = currentAuth;
      }
      next();
    }
  });

  return {
    app,
    repository,
    eventPublisher,
    container,
    setAuth(newAuth) {
      currentAuth = newAuth;
    }
  };
}

describe('Autorización y Seguridad en /api/catalog/admin/*', () => {
  it('responde 401 UNAUTHORIZED cuando no existe contexto de autenticación req.auth', async () => {
    const { app } = createTestEnvironment();

    const resGet = await request(app).get('/api/catalog/admin/services');
    const resPost = await request(app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Lavado', price: 40, estimatedDuration: 25 });

    expect(resGet.status).toBe(401);
    expect(resGet.body.error.code).toBe('UNAUTHORIZED');
    expect(resPost.status).toBe(401);
  });

  it('no confía en encabezados arbitrarios enviados por el cliente como X-User-Role', async () => {
    const { app } = createTestEnvironment();

    const res = await request(app)
      .get('/api/catalog/admin/services')
      .set('X-User-Role', 'ADMIN')
      .set('X-Admin', 'true');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responde 403 FORBIDDEN cuando el usuario está autenticado pero no tiene rol ADMIN', async () => {
    const { app } = createTestEnvironment({
      auth: { userId: 'u-1', role: 'OPERATOR', roles: ['CUSTOMER'] }
    });

    const res = await request(app).get('/api/catalog/admin/services');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('permite el acceso con rol ADMIN en req.auth.role o req.auth.roles', async () => {
    const env = createTestEnvironment({ auth: { userId: 'admin-1', role: 'ADMIN' } });

    const res1 = await request(env.app).get('/api/catalog/admin/services');
    expect(res1.status).toBe(200);

    env.setAuth({ sub: 'admin-2', roles: ['operator', 'admin'] });
    const res2 = await request(env.app).get('/api/catalog/admin/services');
    expect(res2.status).toBe(200);
  });
});

describe('Endpoints Administrativos (/api/catalog/admin/services)', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment({ auth: { userId: 'admin-1', role: 'ADMIN' } });
  });

  it('POST /api/catalog/admin/services — crea un servicio (201)', async () => {
    const res = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({
        name: 'Lavado Completo',
        description: 'Exterior e interior',
        price: 80.5,
        currency: 'BOB',
        estimatedDuration: 45
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Lavado Completo',
      description: 'Exterior e interior',
      price: 80.5,
      currency: 'BOB',
      estimatedDuration: 45,
      isActive: true,
      version: 1
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST /api/catalog/admin/services — rechaza nombre duplicado con 409', async () => {
    await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Encerado', price: 40, estimatedDuration: 20 });

    const dup = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: '  encerado ', price: 50, estimatedDuration: 30 });

    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_SERVICE_NAME');
  });

  it('PUT /api/catalog/admin/services/:id — actualiza datos generales (200)', async () => {
    const created = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Básico', description: 'Simple', price: 30, estimatedDuration: 20 });

    const res = await request(env.app)
      .put(`/api/catalog/admin/services/${created.body.id}`)
      .send({
        name: 'Básico Plus',
        description: 'Con aspirado',
        estimatedDuration: 30
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Básico Plus',
      description: 'Con aspirado',
      estimatedDuration: 30,
      price: 30,
      version: 2
    });
  });

  it('PATCH /api/catalog/admin/services/:id/price — actualiza el precio (200)', async () => {
    const created = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Motor', price: 60, estimatedDuration: 35 });

    const res = await request(env.app)
      .patch(`/api/catalog/admin/services/${created.body.id}/price`)
      .send({ price: 75.25, currency: 'BOB' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      price: 75.25,
      currency: 'BOB',
      version: 2
    });
  });

  it('PATCH /activate y /deactivate — desactiva y activa un servicio y responde 409 si el estado ya era ese', async () => {
    const created = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Tapicería', price: 110, estimatedDuration: 60 });
    const id = created.body.id;

    // Activar cuando ya está activo -> 409
    const alreadyActive = await request(env.app).patch(`/api/catalog/admin/services/${id}/activate`);
    expect(alreadyActive.status).toBe(409);
    expect(alreadyActive.body.error.code).toBe('SERVICE_ALREADY_ACTIVE');

    // Desactivar -> 200
    const deactivated = await request(env.app).patch(`/api/catalog/admin/services/${id}/deactivate`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    // Desactivar cuando ya está inactivo -> 409
    const alreadyInactive = await request(env.app).patch(`/api/catalog/admin/services/${id}/deactivate`);
    expect(alreadyInactive.status).toBe(409);
    expect(alreadyInactive.body.error.code).toBe('SERVICE_ALREADY_INACTIVE');

    // Activar -> 200
    const activated = await request(env.app).patch(`/api/catalog/admin/services/${id}/activate`);
    expect(activated.status).toBe(200);
    expect(activated.body.isActive).toBe(true);
  });

  it('GET /api/catalog/admin/services — lista activos e inactivos, filtra por estado y pagina', async () => {
    const s1 = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Zafiro', price: 90, estimatedDuration: 50 });
    await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Alfa', price: 40, estimatedDuration: 20 });
    await request(env.app).patch(`/api/catalog/admin/services/${s1.body.id}/deactivate`);

    const all = await request(env.app).get('/api/catalog/admin/services?page=1&pageSize=10');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 2, page: 1, pageSize: 10 });
    expect(all.body.items.map((s) => s.name)).toEqual(['Alfa', 'Zafiro']);

    const inactiveByBool = await request(env.app).get('/api/catalog/admin/services?isActive=false');
    expect(inactiveByBool.status).toBe(200);
    expect(inactiveByBool.body.total).toBe(1);
    expect(inactiveByBool.body.items[0].name).toBe('Zafiro');

    const activeByStatus = await request(env.app).get('/api/catalog/admin/services?status=active');
    expect(activeByStatus.status).toBe(200);
    expect(activeByStatus.body.total).toBe(1);
    expect(activeByStatus.body.items[0].name).toBe('Alfa');

    const allByStatus = await request(env.app).get('/api/catalog/admin/services?status=all');
    expect(allByStatus.status).toBe(200);
    expect(allByStatus.body.total).toBe(2);
  });
});

describe('Endpoints Públicos y Consulta por Lote (/api/catalog/services)', () => {
  let env;
  let activeService;
  let inactiveService;

  beforeEach(async () => {
    env = createTestEnvironment({ auth: { userId: 'admin-1', role: 'ADMIN' } });

    const r1 = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Lavado Express', price: 35, estimatedDuration: 20 });
    const r2 = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Acabado Cerámico', price: 150, estimatedDuration: 90 });
    const r3 = await request(env.app)
      .post('/api/catalog/admin/services')
      .send({ name: 'Pulido Profundo', price: 120, estimatedDuration: 80 });

    await request(env.app).patch(`/api/catalog/admin/services/${r3.body.id}/deactivate`);

    activeService = r1.body;
    inactiveService = r3.body;
    void r2;
    env.setAuth(undefined); // Las peticiones públicas no requieren autenticación
  });

  it('GET /api/catalog/services — lista únicamente activos ordenados alfabéticamente con metadatos de paginación', async () => {
    const res = await request(env.app).get('/api/catalog/services');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(res.body.items.map((s) => s.name)).toEqual(['Acabado Cerámico', 'Lavado Express']);
    expect(res.body.items.every((s) => s.isActive === true)).toBe(true);

    const paged = await request(env.app).get('/api/catalog/services?page=2&pageSize=1');
    expect(paged.status).toBe(200);
    expect(paged.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(paged.body.items.map((s) => s.name)).toEqual(['Lavado Express']);
  });

  it('GET /api/catalog/services/:id — devuelve 200 si está activo y 404 si no existe o está inactivo', async () => {
    const ok = await request(env.app).get(`/api/catalog/services/${activeService.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(activeService.id);

    const missing = await request(env.app).get(`/api/catalog/services/${MISSING_ID}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('SERVICE_NOT_FOUND');

    const inactive = await request(env.app).get(`/api/catalog/services/${inactiveService.id}`);
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe('SERVICE_NOT_FOUND');
  });

  it('POST /api/catalog/services/batch — devuelve servicios encontrados (incluyendo inactivos) y notFound', async () => {
    const res = await request(env.app)
      .post('/api/catalog/services/batch')
      .send({ ids: [inactiveService.id, MISSING_ID, activeService.id] });

    expect(res.status).toBe(200);
    expect(res.body.notFound).toEqual([MISSING_ID]);
    expect(res.body.services).toHaveLength(2);
    expect(res.body.services[0]).toMatchObject({
      id: inactiveService.id,
      price: 120,
      currency: 'BOB',
      estimatedDuration: 80,
      isActive: false
    });
    expect(res.body.services[1]).toMatchObject({
      id: activeService.id,
      price: 35,
      currency: 'BOB',
      estimatedDuration: 20,
      isActive: true
    });
  });
});

describe('Validaciones HTTP (400), Conflictos (409), No encontrado (404) y Errores 500', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment({ auth: { userId: 'admin-1', role: 'ADMIN' } });
  });

  it('rechaza UUID inválidos en rutas con 400', async () => {
    expect((await request(env.app).get('/api/catalog/services/no-es-uuid')).status).toBe(400);
    expect(
      (await request(env.app).put('/api/catalog/admin/services/bad-id').send({ name: 'X' })).status
    ).toBe(400);
    expect(
      (await request(env.app).patch('/api/catalog/admin/services/bad-id/price').send({ price: 10 })).status
    ).toBe(400);
    expect((await request(env.app).patch('/api/catalog/admin/services/bad-id/activate')).status).toBe(400);
    expect((await request(env.app).patch('/api/catalog/admin/services/bad-id/deactivate')).status).toBe(400);
  });

  it.each([
    ['body arreglo (no objeto)', [1, 2, 3]],
    ['nombre vacío', { name: '  ', price: 10, estimatedDuration: 15 }],
    ['nombre > 100 chars', { name: 'a'.repeat(101), price: 10, estimatedDuration: 15 }],
    ['descripción no string', { name: 'Ok', description: 123, price: 10, estimatedDuration: 15 }],
    ['descripción > 500 chars', { name: 'Ok', description: 'd'.repeat(501), price: 10, estimatedDuration: 15 }],
    ['precio negativo', { name: 'Ok', price: -1, estimatedDuration: 15 }],
    ['precio con 3 decimales', { name: 'Ok', price: 10.123, estimatedDuration: 15 }],
    ['precio no numérico', { name: 'Ok', price: '10', estimatedDuration: 15 }],
    ['moneda distinta de BOB', { name: 'Ok', price: 10, currency: 'USD', estimatedDuration: 15 }],
    ['duración 0', { name: 'Ok', price: 10, estimatedDuration: 0 }],
    ['duración decimal', { name: 'Ok', price: 10, estimatedDuration: 10.5 }],
    ['propiedad arbitraria id/version', { id: MISSING_ID, version: 9, name: 'Ok', price: 10, estimatedDuration: 15 }]
  ])('POST /admin/services rechaza %s con 400 VALIDATION_ERROR', async (_, payload) => {
    const res = await request(env.app)
      .post('/api/catalog/admin/services')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('valida cuerpos inválidos en PUT, PATCH /price, PATCH /activate y POST /batch', async () => {
    // PUT sin campos o con campo prohibido (price)
    expect(
      (await request(env.app).put(`/api/catalog/admin/services/${MISSING_ID}`).send({})).status
    ).toBe(400);
    expect(
      (
        await request(env.app)
          .put(`/api/catalog/admin/services/${MISSING_ID}`)
          .send({ name: 'Nuevo', price: 99 })
      ).status
    ).toBe(400);

    // PATCH /price con campo prohibido
    expect(
      (
        await request(env.app)
          .patch(`/api/catalog/admin/services/${MISSING_ID}/price`)
          .send({ price: 20, version: 5 })
      ).status
    ).toBe(400);

    // PATCH /activate con propiedades no permitidas
    expect(
      (
        await request(env.app)
          .patch(`/api/catalog/admin/services/${MISSING_ID}/activate`)
          .send({ isActive: true })
      ).status
    ).toBe(400);

    // POST /services/batch con ids vacíos, con UUID inválido o con precios enviados por el cliente
    expect((await request(env.app).post('/api/catalog/services/batch').send({ ids: [] })).status).toBe(400);
    expect(
      (await request(env.app).post('/api/catalog/services/batch').send({ ids: ['bad-uuid'] })).status
    ).toBe(400);
    expect(
      (
        await request(env.app)
          .post('/api/catalog/services/batch')
          .send({ ids: [MISSING_ID], prices: [10] })
      ).status
    ).toBe(400);
  });

  it('valida parámetros de paginación y filtros de estado en GET', async () => {
    expect((await request(env.app).get('/api/catalog/services?page=0')).status).toBe(400);
    expect((await request(env.app).get('/api/catalog/services?page=abc')).status).toBe(400);
    expect((await request(env.app).get('/api/catalog/services?pageSize=101')).status).toBe(400);
    expect((await request(env.app).get('/api/catalog/services?unknown=1')).status).toBe(400);
    expect((await request(env.app).get('/api/catalog/admin/services?isActive=maybe')).status).toBe(400);
    expect((await request(env.app).get('/api/catalog/admin/services?status=deleted')).status).toBe(400);
    expect(
      (await request(env.app).get('/api/catalog/admin/services?isActive=true&status=active')).status
    ).toBe(400);
  });

  it('responde 404 cuando se intenta modificar un servicio inexistente', async () => {
    expect(
      (await request(env.app).put(`/api/catalog/admin/services/${MISSING_ID}`).send({ name: 'X' })).status
    ).toBe(404);
    expect(
      (await request(env.app).patch(`/api/catalog/admin/services/${MISSING_ID}/price`).send({ price: 10 })).status
    ).toBe(404);
    expect((await request(env.app).patch(`/api/catalog/admin/services/${MISSING_ID}/activate`)).status).toBe(404);
    expect((await request(env.app).patch(`/api/catalog/admin/services/${MISSING_ID}/deactivate`)).status).toBe(404);
  });

  it('traduce ConcurrencyConflictError a 409 CONFLICT', async () => {
    const conflictContainer = buildContainer({
      commands: {
        createService: { execute: async () => {} },
        updateService: {
          execute: async () => {
            throw new ConcurrencyConflictError(MISSING_ID, 1);
          }
        },
        changeServicePrice: { execute: async () => {} },
        activateService: { execute: async () => {} },
        deactivateService: { execute: async () => {} }
      },
      queries: {
        getActiveServices: { execute: async () => ({ items: [], total: 0 }) },
        getAllServices: { execute: async () => ({ items: [], total: 0 }) },
        getServiceById: { execute: async () => ({}) },
        getServicesByIds: { execute: async () => ({ services: [], notFound: [] }) }
      }
    });

    const app = createApp(conflictContainer, {
      authContextMiddleware: (req, _res, next) => {
        req.auth = { userId: 'admin-1', role: 'ADMIN' };
        next();
      }
    });

    const res = await request(app)
      .put(`/api/catalog/admin/services/${MISSING_ID}`)
      .send({ name: 'Conflicto' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONCURRENCY_CONFLICT');
  });

  it('responde 500 INTERNAL_ERROR ante errores inesperados sin exponer detalles internos ni stack traces', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const failingContainer = buildContainer({
      commands: {
        createService: { execute: async () => {} },
        updateService: { execute: async () => {} },
        changeServicePrice: { execute: async () => {} },
        activateService: { execute: async () => {} },
        deactivateService: { execute: async () => {} }
      },
      queries: {
        getActiveServices: {
          execute: async () => {
            throw new Error('SELECT * FROM wash_services -- password=secret');
          }
        },
        getAllServices: { execute: async () => ({ items: [], total: 0 }) },
        getServiceById: { execute: async () => ({}) },
        getServicesByIds: { execute: async () => ({ services: [], notFound: [] }) }
      }
    });

    const app = createApp(failingContainer);
    const res = await request(app).get('/api/catalog/services');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.'
      }
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|secret|stack/i);

    spy.mockRestore();
  });

  it('valida los constructores de CatalogController y createCatalogRouter', () => {
    expect(() => new CatalogController({})).toThrow(/requires both commands and queries/);
    expect(() => createCatalogRouter({})).toThrow(/requires a CatalogController/);
  });
});
