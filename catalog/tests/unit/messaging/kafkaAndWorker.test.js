'use strict';

const KafkaEventPublisher = require('../../../src/infrastructure/messaging/KafkaEventPublisher');
const {
  getKafkaEventPublisher,
  closeKafkaEventPublisher
} = require('../../../src/infrastructure/messaging/KafkaEventPublisher');
const OutboxWorker = require('../../../src/infrastructure/messaging/OutboxWorker');
const WashServiceBuilder = require('../../builders/WashServiceBuilder');
const { ServiceCreated } = require('../../../src/domain/events/ServiceEvents');

function createFakeKafkaProducer() {
  return {
    connectCalls: 0,
    disconnectCalls: 0,
    sentBatches: [],
    failOnConnect: null,
    failOnSend: null,
    async connect() {
      this.connectCalls += 1;
      if (this.failOnConnect) throw this.failOnConnect;
    },
    async send(batch) {
      if (this.failOnSend) throw this.failOnSend;
      this.sentBatches.push(batch);
    },
    async disconnect() {
      this.disconnectCalls += 1;
    }
  };
}

afterEach(async () => {
  await closeKafkaEventPublisher();
});

describe('KafkaEventPublisher', () => {
  it('conecta una sola vez, publica en el topic con aggregateId como key y desconecta ordenadamente', async () => {
    const fakeProducer = createFakeKafkaProducer();
    const publisher = new KafkaEventPublisher({
      brokers: ['localhost:9092'],
      clientId: 'catalog-service',
      producer: fakeProducer
    });

    expect(publisher.isConnected).toBe(false);

    const envelope = {
      eventId: '11111111-1111-4111-8111-111111111111',
      evento: 'ServiceCreated',
      eventVersion: 1,
      fechaEmision: '2026-01-01T10:00:00.000Z',
      aggregateId: '22222222-2222-4222-8222-222222222222',
      origen: 'catalog-service',
      datos: { name: 'Lavado' }
    };

    await publisher.publishMessage({
      topic: 'catalog.service.created',
      key: envelope.aggregateId,
      value: envelope,
      headers: { eventId: envelope.eventId }
    });
    // Segunda llamada reutiliza la conexión activa
    await publisher.publishMessage({
      topic: 'catalog.service.updated',
      key: envelope.aggregateId,
      value: JSON.stringify(envelope)
    });

    expect(fakeProducer.connectCalls).toBe(1);
    expect(publisher.isConnected).toBe(true);
    expect(fakeProducer.sentBatches).toHaveLength(2);
    expect(fakeProducer.sentBatches[0]).toEqual({
      topic: 'catalog.service.created',
      messages: [
        {
          key: '22222222-2222-4222-8222-222222222222',
          value: JSON.stringify(envelope),
          headers: { eventId: envelope.eventId }
        }
      ]
    });

    await publisher.disconnect();
    expect(fakeProducer.disconnectCalls).toBe(1);
    expect(publisher.isConnected).toBe(false);

    // Desconectar cuando ya está desconectado es seguro e idempotente
    await publisher.disconnect();
    expect(fakeProducer.disconnectCalls).toBe(1);
  });

  it('marca desconectado si falla send y reconecta automáticamente en el siguiente intento', async () => {
    const fakeProducer = createFakeKafkaProducer();
    fakeProducer.failOnSend = new Error('broker leader not available');

    const publisher = new KafkaEventPublisher({ producer: fakeProducer });

    await expect(
      publisher.publishMessage({
        topic: 'catalog.service.created',
        key: 'agg-1',
        value: { ok: true }
      })
    ).rejects.toThrow('broker leader not available');

    expect(publisher.isConnected).toBe(false);

    fakeProducer.failOnSend = null;
    await publisher.publishMessage({
      topic: 'catalog.service.created',
      key: 'agg-1',
      value: { ok: true }
    });

    expect(fakeProducer.connectCalls).toBe(2);
    expect(publisher.isConnected).toBe(true);
  });

  it('valida parámetros obligatorios y soporta publishAll de eventos de dominio', async () => {
    expect(() => new KafkaEventPublisher({ brokers: [] })).toThrow(/at least one Kafka broker/);

    const fakeProducer = createFakeKafkaProducer();
    const publisher = new KafkaEventPublisher({ producer: fakeProducer });

    await expect(publisher.publishMessage({ key: 'k', value: {} })).rejects.toThrow(/requires a topic/);
    await expect(publisher.publishMessage({ topic: 't', value: {} })).rejects.toThrow(/requires a message key/);

    await publisher.publishAll([]);
    expect(fakeProducer.sentBatches).toHaveLength(0);

    const event = new ServiceCreated('22222222-2222-4222-8222-222222222222', new Date('2026-01-01T00:00:00Z'), {
      name: 'Lavado'
    });
    await publisher.publishAll([event]);
    expect(fakeProducer.sentBatches).toHaveLength(1);
    expect(fakeProducer.sentBatches[0].topic).toBe('catalog.service.created');
  });

  it('reutiliza la instancia Singleton con getKafkaEventPublisher y la cierra con closeKafkaEventPublisher', async () => {
    const p1 = getKafkaEventPublisher({ brokers: ['localhost:9092'], clientId: 'catalog-service' });
    const p2 = getKafkaEventPublisher({ brokers: ['localhost:9092'], clientId: 'catalog-service' });

    expect(p1).toBe(p2);
    await closeKafkaEventPublisher();

    const p3 = getKafkaEventPublisher({ brokers: ['localhost:9092'], clientId: 'catalog-service' });
    expect(p3).not.toBe(p1);
  });
});

describe('OutboxWorker (unitario)', () => {
  it('impide ciclos simultáneos dentro del mismo proceso y espera al lote activo en stop()', async () => {
    let resolveBatch;
    let calls = 0;

    const fakeOutboxRepository = {
      processPendingBatch() {
        calls += 1;
        return new Promise((resolve) => {
          resolveBatch = () => resolve({ processed: 2, published: 2, failed: 0 });
        });
      }
    };

    const worker = new OutboxWorker({
      outboxRepository: fakeOutboxRepository,
      kafkaPublisher: { publishMessage: jest.fn() },
      pollIntervalMs: 10000,
      batchSize: 10
    });

    const firstPromise = worker.processBatch();
    expect(worker.isProcessing).toBe(true);

    // Segunda invocación mientras la primera sigue en curso: se omite sin lanzar otro ciclo
    const overlapping = await worker.processBatch();
    expect(overlapping).toEqual({ processed: 0, published: 0, failed: 0, skipped: true });
    expect(calls).toBe(1);

    const stopPromise = worker.stop();
    resolveBatch();

    const firstResult = await firstPromise;
    await stopPromise;

    expect(firstResult).toEqual({ processed: 2, published: 2, failed: 0 });
    expect(worker.isProcessing).toBe(false);
    expect(worker.isRunning).toBe(false);
  });

  it('inicia y detiene el temporizador periódico y captura errores de infraestructura sin caer', async () => {
    const warnSpy = jest.fn();
    const fakeOutboxRepository = {
      async processPendingBatch() {
        throw new Error('database temporary glitch');
      }
    };

    const worker = new OutboxWorker({
      outboxRepository: fakeOutboxRepository,
      kafkaPublisher: { publishMessage: jest.fn() },
      pollIntervalMs: 50,
      batchSize: 5,
      logger: { warn: warnSpy, info: jest.fn(), error: jest.fn() }
    });

    worker.start();
    worker.start(); // idempotente
    expect(worker.isRunning).toBe(true);

    const res = await worker.processBatch();
    expect(res).toEqual({ processed: 0, published: 0, failed: 0 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('database temporary glitch'));

    await worker.stop();
    expect(worker.isRunning).toBe(false);
  });

  it('valida dependencias obligatorias en el constructor', () => {
    expect(() => new OutboxWorker({})).toThrow(/requires an outboxRepository/);
    expect(() => new OutboxWorker({ outboxRepository: {} })).toThrow(/requires a kafkaPublisher/);
  });
});

describe('WashServiceBuilder (Patrón Builder)', () => {
  it('construye paso a paso servicios nuevos, reconstruidos e inactivos, y DTOs de creación', () => {
    const newService = WashServiceBuilder.aWashService()
      .withName('Lavado Chasis')
      .withDescription('Inferior a presión')
      .withPrice(65.5, 'BOB')
      .withEstimatedDuration(35)
      .buildNew();

    expect(newService.name).toBe('Lavado Chasis');
    expect(newService.price).toBe(65.5);
    expect(newService.isActive).toBe(true);
    expect(newService.version).toBe(1);
    expect(newService.pullDomainEvents()).toHaveLength(1);

    const restoredInactive = WashServiceBuilder.aWashService()
      .withId('33333333-3333-4333-8333-333333333333')
      .withName('Encerado')
      .withPrice(40)
      .withVersion(3)
      .inactive()
      .withTimestamps('2026-02-01T00:00:00.000Z')
      .buildRestored();

    expect(restoredInactive.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(restoredInactive.isActive).toBe(false);
    expect(restoredInactive.version).toBe(3);
    expect(restoredInactive.pullDomainEvents()).toHaveLength(0);

    const inputDto = WashServiceBuilder.aWashService()
      .withName('Motor')
      .withPrice(90)
      .active()
      .buildCreateInput();

    expect(inputDto).toEqual({
      name: 'Motor',
      description: 'Lavado exterior e interior completo',
      price: 90,
      currency: 'BOB',
      estimatedDuration: 45
    });
  });
});
