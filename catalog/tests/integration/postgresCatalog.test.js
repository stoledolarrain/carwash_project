'use strict';

const {
  EXPECTED_DATABASE,
  extractDatabaseName,
  createPool,
  getPool,
  verifyDatabaseConnection,
  closePool
} = require('../../src/infrastructure/database/pool');
const { runMigrations } = require('../../src/infrastructure/database/migrate');
const PgServiceRepository = require('../../src/infrastructure/repositories/PgServiceRepository');
const PgOutboxRepository = require('../../src/infrastructure/outbox/PgOutboxRepository');
const PgUnitOfWork = require('../../src/infrastructure/database/PgUnitOfWork');
const { buildContainer } = require('../../src/container');
const WashService = require('../../src/domain/entities/WashService');
const CreateService = require('../../src/application/commands/CreateService');
const UpdateService = require('../../src/application/commands/UpdateService');
const ChangeServicePrice = require('../../src/application/commands/ChangeServicePrice');
const ActivateService = require('../../src/application/commands/ActivateService');
const DeactivateService = require('../../src/application/commands/DeactivateService');
const GetActiveServices = require('../../src/application/queries/GetActiveServices');
const GetAllServices = require('../../src/application/queries/GetAllServices');
const GetServiceById = require('../../src/application/queries/GetServiceById');
const GetServicesByIds = require('../../src/application/queries/GetServicesByIds');
const {
  DuplicateServiceNameError,
  ConcurrencyConflictError,
  ServiceNotFoundError
} = require('../../src/application/errors/ApplicationErrors');
const {
  InvalidPriceError,
  InvalidDurationError,
  InvalidDescriptionError
} = require('../../src/domain/errors/DomainErrors');

/**
 * Schema temporal aislado dentro de PostgreSQL para ejecutar todas las pruebas
 * de integración sin tocar ni borrar ningún dato del schema `public` de `catalog_db`.
 */
const TEST_SCHEMA = `catalog_test_${process.pid}_${Date.now()}`;
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

let pool;
let repository;
let outboxRepository;
let unitOfWork;
let container;

beforeAll(async () => {
  pool = createPool({ max: 5, schema: TEST_SCHEMA });

  await verifyDatabaseConnection(pool, EXPECTED_DATABASE);
  await runMigrations({ pool, schema: TEST_SCHEMA });

  repository = new PgServiceRepository({ pool });
  outboxRepository = new PgOutboxRepository({ pool });
  unitOfWork = new PgUnitOfWork({ pool });
  container = buildContainer({ pool, repository, outboxRepository, unitOfWork });
});

beforeEach(async () => {
  await pool.query(`TRUNCATE TABLE "${TEST_SCHEMA}".outbox_events, "${TEST_SCHEMA}".wash_services`);
});

afterAll(async () => {
  if (pool) {
    await pool.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await closePool(pool);
  }
  await closePool();
});

describe('Conexión a PostgreSQL y migraciones', () => {
  it('conecta a catalog_db y valida el nombre de la base de datos', async () => {
    const dbName = await verifyDatabaseConnection(pool, 'catalog_db');

    expect(dbName).toBe('catalog_db');
    await expect(verifyDatabaseConnection(pool, 'otra_db')).rejects.toThrow(/unexpected database/i);
  });

  it('valida la cadena DATABASE_URL y reutiliza el pool singleton', () => {
    expect(extractDatabaseName('postgresql://u:p@localhost:5432/catalog_db')).toBe('catalog_db');
    expect(() => extractDatabaseName('')).toThrow(/DATABASE_URL is required/);
    expect(() => extractDatabaseName('no-es-url')).toThrow(/not a valid PostgreSQL connection URL/);

    const p1 = getPool();
    const p2 = getPool();
    expect(p1).toBe(p2);
  });

  it('aplica migraciones de forma idempotente sin volver a ejecutar las ya aplicadas', async () => {
    const secondRun = await runMigrations({ pool, schema: TEST_SCHEMA });

    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toContain('001_create_catalog_tables.sql');
  });

  it('impone restricciones CHECK en PostgreSQL para precio, duración, moneda y versión', async () => {
    const baseInsert = `
      INSERT INTO "${TEST_SCHEMA}".wash_services
        (id, name, description, price, currency, estimated_duration, is_active, version)
      VALUES ($1, $2, '', $3, $4, $5, true, $6)
    `;

    // Precio negativo rechazado por CHECK (price >= 0)
    await expect(
      pool.query(baseInsert, ['11111111-1111-4111-8111-111111111111', 'Test Neg', -1, 'BOB', 30, 1])
    ).rejects.toThrow();

    // Duración <= 0 rechazada por CHECK (estimated_duration > 0)
    await expect(
      pool.query(baseInsert, ['11111111-1111-4111-8111-111111111112', 'Test Dur', 10, 'BOB', 0, 1])
    ).rejects.toThrow();

    // Moneda distinta de BOB rechazada por CHECK (currency = 'BOB')
    await expect(
      pool.query(baseInsert, ['11111111-1111-4111-8111-111111111113', 'Test Cur', 10, 'USD', 30, 1])
    ).rejects.toThrow();
  });
});

describe('PgServiceRepository — CRUD y consultas SQL', () => {
  it('crea y recupera un servicio por ID y permite precio cero', async () => {
    const created = await container.commands.createService.execute({
      name: 'Cortesía',
      description: 'Lavado gratuito de cortesía',
      price: 0,
      estimatedDuration: 15
    });

    expect(created).toMatchObject({
      name: 'Cortesía',
      description: 'Lavado gratuito de cortesía',
      price: 0,
      currency: 'BOB',
      estimatedDuration: 15,
      isActive: true,
      version: 1
    });

    const fetched = await container.queries.getServiceById.execute({ id: created.id });
    expect(fetched).toEqual(created);
  });

  it('busca por nombre ignorando mayúsculas y minúsculas', async () => {
    const created = await container.commands.createService.execute({
      name: 'Lavado Ejecutivo',
      price: 65.5,
      estimatedDuration: 40
    });

    const foundLower = await repository.findByName('lavado ejecutivo');
    const foundUpper = await repository.findByName('  LAVADO EJECUTIVO ');
    const notFound = await repository.findByName('Inexistente');

    expect(foundLower.id).toBe(created.id);
    expect(foundUpper.id).toBe(created.id);
    expect(notFound).toBeNull();
  });

  it('impide nombres duplicados sin distinguir mayúsculas (en Application y en índice UNIQUE LOWER(name))', async () => {
    await container.commands.createService.execute({
      name: 'Encerado Especial',
      price: 45,
      estimatedDuration: 25
    });

    await expect(
      container.commands.createService.execute({
        name: 'encerado especial',
        price: 50,
        estimatedDuration: 30
      })
    ).rejects.toThrow(DuplicateServiceNameError);

    // También directamente contra el repositorio saltando la validación previa de Application
    const directDuplicate = WashService.create({
      name: 'ENCERADO ESPECIAL',
      price: 50,
      estimatedDuration: 30
    });
    await expect(repository.save(directDuplicate)).rejects.toThrow(DuplicateServiceNameError);
  });

  it('consulta múltiples servicios por IDs e identifica los inexistentes (incluyendo inactivos)', async () => {
    const s1 = await container.commands.createService.execute({ name: 'Básico', price: 30, estimatedDuration: 20 });
    const s2 = await container.commands.createService.execute({ name: 'Motor', price: 70, estimatedDuration: 35 });
    await container.commands.deactivateService.execute({ id: s2.id });

    const result = await container.queries.getServicesByIds.execute({
      ids: [s2.id, MISSING_ID, s1.id]
    });

    expect(result.notFound).toEqual([MISSING_ID]);
    expect(result.services.map((s) => s.id)).toEqual([s2.id, s1.id]);
    expect(result.services[0].isActive).toBe(false);
    expect(result.services[1].isActive).toBe(true);
  });

  it('consulta servicios activos, todos los servicios, ordena por nombre y pagina con page y pageSize', async () => {
    const z = await container.commands.createService.execute({ name: 'Zafiro', price: 90, estimatedDuration: 50 });
    await container.commands.createService.execute({ name: 'Alfa', price: 40, estimatedDuration: 20 });
    await container.commands.createService.execute({ name: 'Beta', price: 50, estimatedDuration: 25 });
    await container.commands.deactivateService.execute({ id: z.id });

    const active = await container.queries.getActiveServices.execute();
    expect(active.total).toBe(2);
    expect(active.items.map((s) => s.name)).toEqual(['Alfa', 'Beta']);

    const all = await container.queries.getAllServices.execute();
    expect(all.total).toBe(3);
    expect(all.items.map((s) => s.name)).toEqual(['Alfa', 'Beta', 'Zafiro']);

    const page1 = await container.queries.getAllServices.execute({ page: 1, pageSize: 2 });
    expect(page1).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(page1.items.map((s) => s.name)).toEqual(['Alfa', 'Beta']);

    const page2 = await container.queries.getAllServices.execute({ page: 2, pageSize: 2 });
    expect(page2).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page2.items.map((s) => s.name)).toEqual(['Zafiro']);

    const onlyInactive = await container.queries.getAllServices.execute({ isActive: false, page: 1, pageSize: 5 });
    expect(onlyInactive.total).toBe(1);
    expect(onlyInactive.items[0].name).toBe('Zafiro');
  });

  it('rechaza precios negativos, duraciones inválidas y descripciones de más de 500 caracteres', async () => {
    await expect(
      container.commands.createService.execute({ name: 'Inv1', price: -5, estimatedDuration: 20 })
    ).rejects.toThrow(InvalidPriceError);

    await expect(
      container.commands.createService.execute({ name: 'Inv2', price: 10, estimatedDuration: 0 })
    ).rejects.toThrow(InvalidDurationError);

    await expect(
      container.commands.createService.execute({
        name: 'Inv3',
        description: 'a'.repeat(501),
        price: 10,
        estimatedDuration: 20
      })
    ).rejects.toThrow(InvalidDescriptionError);
  });
});

describe('Actualizaciones, Concurrencia Optimista y Transactional Outbox', () => {
  it('actualiza datos, precio, activa/desactiva, incrementa version y registra cada evento en outbox_events', async () => {
    const created = await container.commands.createService.execute({
      name: 'Lavado Chasis',
      description: 'Lavado inferior',
      price: 55,
      estimatedDuration: 30
    });
    expect(created.version).toBe(1);

    const updated = await container.commands.updateService.execute({
      id: created.id,
      name: 'Lavado Chasis Completo',
      estimatedDuration: 40
    });
    expect(updated.version).toBe(2);

    const priceChanged = await container.commands.changeServicePrice.execute({
      id: created.id,
      price: 68.5
    });
    expect(priceChanged.version).toBe(3);
    expect(priceChanged.price).toBe(68.5);

    const deactivated = await container.commands.deactivateService.execute({ id: created.id });
    expect(deactivated.version).toBe(4);
    expect(deactivated.isActive).toBe(false);

    const activated = await container.commands.activateService.execute({ id: created.id });
    expect(activated.version).toBe(5);
    expect(activated.isActive).toBe(true);

    const pendingEvents = await outboxRepository.findPending();
    expect(pendingEvents.map((e) => e.eventName)).toEqual([
      'ServiceCreated',
      'ServiceUpdated',
      'ServicePriceChanged',
      'ServiceDeactivated',
      'ServiceActivated'
    ]);
    expect(pendingEvents.map((e) => e.topic)).toEqual([
      'catalog.service.created',
      'catalog.service.updated',
      'catalog.service.price-changed',
      'catalog.service.deactivated',
      'catalog.service.activated'
    ]);
    expect(pendingEvents.every((e) => e.aggregateId === created.id && e.publishedAt === null)).toBe(true);
    expect(pendingEvents[2].payload).toMatchObject({
      evento: 'ServicePriceChanged',
      origen: 'catalog-service',
      aggregateId: created.id,
      datos: { previousPrice: 55, newPrice: 68.5, currency: 'BOB', version: 3 }
    });
  });

  it('no inserta eventos en Outbox ni incrementa version cuando una operación no produce cambios reales', async () => {
    const created = await container.commands.createService.execute({
      name: 'Tapicería',
      price: 100,
      estimatedDuration: 60
    });

    await container.commands.updateService.execute({
      id: created.id,
      name: 'Tapicería',
      estimatedDuration: 60
    });
    await container.commands.changeServicePrice.execute({
      id: created.id,
      price: 100
    });

    const current = await container.queries.getServiceById.execute({ id: created.id });
    const pendingEvents = await outboxRepository.findPending();

    expect(current.version).toBe(1);
    expect(pendingEvents).toHaveLength(1);
    expect(pendingEvents[0].eventName).toBe('ServiceCreated');
  });

  it('detecta conflicto de concurrencia optimista cuando otro proceso modificó el servicio antes de guardar', async () => {
    const created = await container.commands.createService.execute({
      name: 'Desinfección Ozono',
      price: 75,
      estimatedDuration: 30
    });

    // Dos procesos leen la misma versión (version = 1)
    const copyA = await repository.findById(created.id);
    const copyB = await repository.findById(created.id);

    // El proceso A actualiza primero (pasa a version = 2)
    copyA.changePrice(80);
    await repository.saveWithOutbox(copyA, copyA.pullDomainEvents());

    // El proceso B intenta guardar basándose en la versión 1 obsoleta -> ConcurrencyConflictError
    copyB.changePrice(90);
    await expect(
      repository.saveWithOutbox(copyB, copyB.pullDomainEvents())
    ).rejects.toThrow(ConcurrencyConflictError);

    // El valor en base de datos sigue siendo el del proceso A (80) y solo hay 2 eventos en el Outbox
    const stored = await repository.findById(created.id);
    const pending = await outboxRepository.findPending();
    expect(stored.price).toBe(80);
    expect(stored.version).toBe(2);
    expect(pending).toHaveLength(2);
  });

  it('lanza ServiceNotFoundError si se intenta actualizar un registro que fue eliminado externamente', async () => {
    const ghost = WashService.restore({
      id: MISSING_ID,
      name: 'Fantasma',
      description: '',
      priceCents: 1000,
      currency: 'BOB',
      estimatedDuration: 10,
      isActive: true,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(repository.save(ghost)).rejects.toThrow(ServiceNotFoundError);
  });

  it('ejecuta ROLLBACK de wash_services si falla la inserción en outbox_events (atomicidad del Transactional Outbox)', async () => {
    const failingUnitOfWork = new PgUnitOfWork({
      pool,
      createOutboxRepository: () => ({
        async saveAll() {
          throw new Error('simulated outbox insertion failure');
        }
      })
    });

    const createWithFailingOutbox = new CreateService({
      repository,
      unitOfWork: failingUnitOfWork
    });

    await expect(
      createWithFailingOutbox.execute({
        name: 'Servicio Que Debe Revertirse',
        price: 50,
        estimatedDuration: 25
      })
    ).rejects.toThrow('simulated outbox insertion failure');

    // Ni el servicio ni el evento deben existir en PostgreSQL tras el ROLLBACK
    const found = await repository.findByName('Servicio Que Debe Revertirse');
    const pending = await outboxRepository.findPending();
    expect(found).toBeNull();
    expect(pending).toHaveLength(0);
  });

  it('ejecuta ROLLBACK en saveWithOutbox directo cuando un evento es inválido', async () => {
    const service = WashService.create({
      name: 'Rollback Directo',
      price: 40,
      estimatedDuration: 20
    });

    // Forzamos un evento con aggregateId no-UUID para que PostgreSQL falle al insertar en outbox_events
    const badEvent = {
      name: 'ServiceCreated',
      aggregateId: 'not-a-uuid',
      occurredAt: new Date(),
      payload: {}
    };

    await expect(repository.saveWithOutbox(service, [badEvent])).rejects.toThrow();

    expect(await repository.findById(service.id)).toBeNull();
    expect(await outboxRepository.findPending()).toHaveLength(0);
  });

  it('permite marcar eventos de Outbox como publicados o registrar fallos de publicación', async () => {
    await container.commands.createService.execute({
      name: 'Pulido Óptico',
      price: 60,
      estimatedDuration: 30
    });

    const [event] = await outboxRepository.findPending();
    expect(event.attempts).toBe(0);

    const failed = await outboxRepository.recordFailure(event.id, 'broker unreachable');
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe('broker unreachable');
    expect(failed.publishedAt).toBeNull();

    const published = await outboxRepository.markPublished(event.id);
    expect(published.attempts).toBe(2);
    expect(published.lastError).toBeNull();
    expect(published.publishedAt).toBeInstanceOf(Date);

    expect(await outboxRepository.findPending()).toHaveLength(0);
  });
});
