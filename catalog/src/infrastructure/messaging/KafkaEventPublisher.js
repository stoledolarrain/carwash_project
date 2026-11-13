const crypto = require('node:crypto');
const { Kafka, logLevel } = require('kafkajs');
const EventPublisher = require('../../application/ports/EventPublisher');
const { config: defaultConfig } = require('../../config/env');
const { resolveTopic, buildEnvelope } = require('../outbox/PgOutboxRepository');

let sharedKafkaEventPublisher = null;
let sharedPublisherSignature = null;

function buildConfigSignature(kafkaConfig) {
  return JSON.stringify({
    brokers: kafkaConfig.brokers,
    clientId: kafkaConfig.clientId
  });
}

/**
 * Adaptador de Apache Kafka basado en `kafkajs`.
 * - No establece conexiones durante la importación del módulo.
 * - Reutiliza una única instancia del producer por proceso (administrada por el contenedor / `getKafkaEventPublisher`).
 * - Permite inyectar un `producer` falso en las pruebas unitarias.
 * - Espera la confirmación del broker antes de resolver `publishMessage`.
 */
class KafkaEventPublisher extends EventPublisher {
  /**
   * @param {{ brokers?: string[], clientId?: string, producer?: object, kafka?: object }} [options]
   */
  constructor({
    brokers = defaultConfig.kafka.brokers,
    clientId = defaultConfig.kafka.clientId,
    producer = null,
    kafka = null
  } = {}) {
    super();
    if (!Array.isArray(brokers) || brokers.length === 0) {
      throw new Error('KafkaEventPublisher requires at least one Kafka broker.');
    }
    this.brokers = brokers;
    this.clientId = clientId || 'catalog-service';
    this.#injectedProducer = producer;
    this.#kafkaInstance = kafka;
    this.#producer = producer || null;
    this.#connected = false;
  }

  #injectedProducer;
  #kafkaInstance;
  #producer;
  #connected;

  get isConnected() {
    return this.#connected;
  }

  #resolveProducer() {
    if (!this.#producer) {
      const kafkaClient =
        this.#kafkaInstance ||
        new Kafka({
          clientId: this.clientId,
          brokers: this.brokers,
          logLevel: logLevel.NOTHING
        });
      this.#producer = kafkaClient.producer();
    }
    return this.#producer;
  }

  /** Conecta el producer a Kafka si aún no está conectado. */
  async connect() {
    if (this.#connected) {
      return;
    }
    const producer = this.#resolveProducer();
    await producer.connect();
    this.#connected = true;
  }

  /**
   * Publica un único mensaje en el topic indicado usando `key` (`aggregateId`) y el sobre JSON.
   * Si el producer no estaba conectado, se conecta automáticamente.
   * Si `send` rechaza, marca la conexión como no verificada para reconectar en el siguiente intento.
   *
   * @param {{ topic: string, key: string, value: object | string, headers?: Record<string, string> }} message
   */
  async publishMessage({ topic, key, value, headers = {} }) {
    if (!topic) {
      throw new Error('KafkaEventPublisher.publishMessage requires a topic.');
    }
    if (!key) {
      throw new Error('KafkaEventPublisher.publishMessage requires a message key (aggregateId).');
    }

    await this.connect();

    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    try {
      await this.#producer.send({
        topic,
        messages: [
          {
            key: String(key),
            value: serializedValue,
            headers
          }
        ]
      });
    } catch (err) {
      this.#connected = false;
      throw err;
    }
  }

  /**
   * Implementación del puerto `EventPublisher.publishAll(events)` por compatibilidad.
   * Nota: en la arquitectura de Catalog Service, los Commands escriben en `outbox_events`
   * dentro de la transacción de PostgreSQL y `OutboxWorker` invoca `publishMessage` posteriormente.
   */
  async publishAll(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
      return;
    }
    for (const event of events) {
      const topic = resolveTopic(event.name);
      const envelope = buildEnvelope(event.id || crypto.randomUUID(), event);
      await this.publishMessage({
        topic,
        key: event.aggregateId,
        value: envelope
      });
    }
  }

  /** Desconecta ordenadamente el producer de Kafka. */
  async disconnect() {
    if (!this.#producer || !this.#connected) {
      this.#connected = false;
      return;
    }
    try {
      await this.#producer.disconnect();
    } finally {
      this.#connected = false;
    }
  }
}

/**
 * Devuelve la instancia compartida del `KafkaEventPublisher` (Singleton por proceso)
 * para reutilizar una única instancia del producer Kafka.
 */
function getKafkaEventPublisher(options = {}) {
  if (options.producer || options.kafka) {
    return new KafkaEventPublisher(options);
  }
  const kafkaConfig = {
    brokers: options.brokers || defaultConfig.kafka.brokers,
    clientId: options.clientId || defaultConfig.kafka.clientId
  };
  const signature = buildConfigSignature(kafkaConfig);

  if (!sharedKafkaEventPublisher || sharedPublisherSignature !== signature) {
    sharedKafkaEventPublisher = new KafkaEventPublisher(kafkaConfig);
    sharedPublisherSignature = signature;
  }
  return sharedKafkaEventPublisher;
}

/** Desconecta y limpia el publisher compartido si existe. */
async function closeKafkaEventPublisher(publisher = sharedKafkaEventPublisher) {
  if (!publisher) return;
  if (publisher === sharedKafkaEventPublisher) {
    sharedKafkaEventPublisher = null;
    sharedPublisherSignature = null;
  }
  await publisher.disconnect();
}

module.exports = KafkaEventPublisher;
module.exports.getKafkaEventPublisher = getKafkaEventPublisher;
module.exports.closeKafkaEventPublisher = closeKafkaEventPublisher;
