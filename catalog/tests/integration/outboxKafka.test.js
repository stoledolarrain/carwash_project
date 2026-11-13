'use strict';

const {
  EXPECTED_DATABASE,
  createPool,
  verifyDatabaseConnection,
  closePool
} = require('../../src/infrastructure/database/pool');
const { runMigrations } = require('../../src/infrastructure/database/migrate');
const PgServiceRepository = require('../../src/infrastructure/repositories/PgServiceRepository');
const PgOutboxRepository = require('../../src/infrastructure/outbox/PgOutboxRepository');
const PgUnitOfWork = require('../../src/infrastructure/database/PgUnitOfWork');
const KafkaEventPublisher = require('../../src/infrastructure/messaging/KafkaEventPublisher');
const OutboxWorker = require('../../src/infrastructure/messaging/OutboxWorker');
const { buildContainer } = require('../../src/container');
const WashServiceBuilder = require('../builders/WashServiceBuilder');

const TEST_SCHEMA = `catalog_outbox_test_${process.pid}_${Date.now()}`;

let pool;
let repository;
let outboxRepository;
let unitOfWork;
let container;

beforeAll(async () => {
  pool = createPool({ max: 6, schema: TEST_SCHEMA });
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

function createRecordingProducer({ failWhen } = {}) {
  return {
    connected: false,
    sent: [],
    async connect() {
      this.connected = true;
    },
    async send(batch) {
      const msg = batch.messages[0];
      const parsed = JSON.parse(msg.value);
      if (failWhen && failWhen({ topic: batch.topic, key: msg.key, envelope: parsed })) {
        throw new Error('simulated kafka broker failure for postgresql://user:secret@localhost:5432/db');
      }
      this.sent.push({
        topic: batch.topic,
        key: msg.key,
        headers: msg.headers,
        envelope: parsed
      });
    },
    async disconnect() {
      this.connected = false;
    }
  };
}

describe('Integración Outbox -> Kafka con PostgreSQL real (FOR UPDATE SKIP LOCKED)', () => {
  it('publica todos los tipos de eventos con el sobre acordado, topic correcto, aggregateId como key y marca published_at', async () => {
    const created = await container.commands.createService.execute(
      WashServiceBuilder.aWashService()
        .withName('Lavado Integral')
        .withPrice(75)
        .withEstimatedDuration(40)
        .buildCreateInput()
    );
    await container.commands.updateService.execute({ id: created.id, estimatedDuration: 50 });
    await container.commands.changeServicePrice.execute({ id: created.id, price: 85 });
    await container.commands.deactivateService.execute({ id: created.id });
    await container.commands.activateService.execute({ id: created.id });

    const producer = createRecordingProducer();
    const kafkaPublisher = new KafkaEventPublisher({ producer });
    const worker = new OutboxWorker({
      outboxRepository,
      kafkaPublisher,
      batchSize: 10
    });

    const stats = await worker.processBatch();
    expect(stats).toEqual({ processed: 5, published: 5, failed: 0 });
    expect(producer.sent).toHaveLength(5);

    // Verifica topics y clave de partición = aggregateId
    expect(producer.sent.map((m) => m.topic)).toEqual([
      'catalog.service.created',
      'catalog.service.updated',
      'catalog.service.price-changed',
      'catalog.service.deactivated',
      'catalog.service.activated'
    ]);
    expect(producer.sent.every((m) => m.key === created.id)).toBe(true);

    // Verifica estructura exacta del sobre acordado
    const firstEnvelope = producer.sent[0].envelope;
    expect(Object.keys(firstEnvelope).sort()).toEqual(
      ['aggregateId', 'datos', 'eventId', 'eventVersion', 'evento', 'fechaEmision', 'origen'].sort()
    );
    expect(firstEnvelope).toMatchObject({
      evento: 'ServiceCreated',
      eventVersion: 1,
      aggregateId: created.id,
      origen: 'catalog-service',
      datos: {
        id: created.id,
        name: 'Lavado Integral',
        price: 75,
        currency: 'BOB',
        estimatedDuration: 40,
        isActive: true,
        version: 1
      }
    });

    // Todos quedaron marcados con published_at y sin eliminarse de outbox_events
    const pendingAfter = await outboxRepository.findPending();
    expect(pendingAfter).toHaveLength(0);

    const allRows = await pool.query(`SELECT * FROM "${TEST_SCHEMA}".outbox_events ORDER BY created_at ASC`);
    expect(allRows.rowCount).toBe(5);
    expect(allRows.rows.every((r) => r.published_at !== null && Number(r.attempts) === 1 && r.last_error === null)).toBe(
      true
    );

    await kafkaPublisher.disconnect();
  });

  it('procesa por lotes respetando batchSize, registra attempts/last_error sanitizado cuando Kafka falla y se recupera en el siguiente ciclo sin perder eventos', async () => {
    const s1 = await container.commands.createService.execute(
      WashServiceBuilder.aWashService().withName('Servicio 1').buildCreateInput()
    );
    const s2 = await container.commands.createService.execute(
      WashServiceBuilder.aWashService().withName('Servicio 2').buildCreateInput()
    );
    const s3 = await container.commands.createService.execute(
      WashServiceBuilder.aWashService().withName('Servicio 3').buildCreateInput()
    );

    let shouldFailSecond = true;
    const producer = createRecordingProducer({
      failWhen: ({ key }) => shouldFailSecond && key === s2.id
    });
    const kafkaPublisher = new KafkaEventPublisher({ producer });

    // Worker con batchSize = 2: en el primer ciclo procesa s1 (éxito) y s2 (falla)
    const worker = new OutboxWorker({
      outboxRepository,
      kafkaPublisher,
      batchSize: 2
    });

    const cycle1 = await worker.processBatch();
    expect(cycle1).toEqual({ processed: 2, published: 1, failed: 1 });

    // s2 sigue pendiente con attempts = 1 y last_error sanitizado (sin credenciales)
    const pendingAfterCycle1 = await outboxRepository.findPending();
    expect(pendingAfterCycle1.map((e) => e.aggregateId)).toEqual([s2.id, s3.id]);
    const failedEvent = pendingAfterCycle1.find((e) => e.aggregateId === s2.id);
    expect(failedEvent.attempts).toBe(1);
    expect(failedEvent.lastError).toContain('postgresql://[REDACTED]');
    expect(failedEvent.lastError).not.toContain('secret');

    // En el segundo ciclo Kafka se recupera: publica s2 y s3 sin perder ninguno
    shouldFailSecond = false;
    const cycle2 = await worker.processBatch();
    expect(cycle2).toEqual({ processed: 2, published: 2, failed: 0 });

    expect(await outboxRepository.findPending()).toHaveLength(0);
    expect(producer.sent.map((m) => m.key)).toEqual([s1.id, s2.id, s3.id]);
  });

  it('garantiza procesamiento concurrente sin duplicación entre dos workers gracias a FOR UPDATE SKIP LOCKED', async () => {
    for (let i = 1; i <= 6; i += 1) {
      await container.commands.createService.execute(
        WashServiceBuilder.aWashService().withName(`Concurrente ${i}`).buildCreateInput()
      );
    }

    const publishedEventIds = [];
    const slowProducer = {
      async connect() {},
      async send(batch) {
        // Pequeña espera asíncrona para forzar que ambos workers coincidan en el tiempo
        await new Promise((r) => setTimeout(r, 25));
        const parsed = JSON.parse(batch.messages[0].value);
        publishedEventIds.push(parsed.eventId);
      },
      async disconnect() {}
    };

    const workerA = new OutboxWorker({
      outboxRepository: new PgOutboxRepository({ pool }),
      kafkaPublisher: new KafkaEventPublisher({ producer: slowProducer }),
      batchSize: 6
    });
    const workerB = new OutboxWorker({
      outboxRepository: new PgOutboxRepository({ pool }),
      kafkaPublisher: new KafkaEventPublisher({ producer: slowProducer }),
      batchSize: 6
    });

    const [resA, resB] = await Promise.all([workerA.processBatch(), workerB.processBatch()]);

    // Entre ambos workers procesaron exactamente los 6 eventos y ningún eventId se publicó dos veces
    expect(resA.published + resB.published).toBe(6);
    expect(publishedEventIds).toHaveLength(6);
    expect(new Set(publishedEventIds).size).toBe(6);
    expect(await outboxRepository.findPending()).toHaveLength(0);
  });

  it('preserva el orden por aggregate_id: si falla un evento anterior de un servicio, no publica fuera de orden un evento posterior del mismo servicio pero sí avanza con otros servicios', async () => {
    const sA = await container.commands.createService.execute(
      WashServiceBuilder.aWashService().withName('Servicio Orden A').withPrice(40).buildCreateInput()
    );
    await container.commands.changeServicePrice.execute({ id: sA.id, price: 55 });

    const sB = await container.commands.createService.execute(
      WashServiceBuilder.aWashService().withName('Servicio Orden B').withPrice(30).buildCreateInput()
    );

    let failServiceACreated = true;
    const producer = createRecordingProducer({
      failWhen: ({ key, envelope }) =>
        failServiceACreated && key === sA.id && envelope.evento === 'ServiceCreated'
    });
    const kafkaPublisher = new KafkaEventPublisher({ producer });
    const worker = new OutboxWorker({
      outboxRepository,
      kafkaPublisher,
      batchSize: 10
    });

    // Ciclo 1: ServiceCreated de sA falla; ServicePriceChanged de sA no debe adelantarse, pero ServiceCreated de sB sí se publica
    const cycle1 = await worker.processBatch();
    expect(cycle1).toEqual({ processed: 2, published: 1, failed: 1 });
    expect(producer.sent).toHaveLength(1);
    expect(producer.sent[0].key).toBe(sB.id);

    // Ciclo 2: se resuelve el fallo y los dos eventos de sA se publican en orden exacto (ServiceCreated -> ServicePriceChanged)
    failServiceACreated = false;
    const cycle2 = await worker.processBatch();
    expect(cycle2).toEqual({ processed: 2, published: 2, failed: 0 });
    expect(producer.sent.filter((m) => m.key === sA.id).map((m) => m.envelope.evento)).toEqual([
      'ServiceCreated',
      'ServicePriceChanged'
    ]);
  });
});
