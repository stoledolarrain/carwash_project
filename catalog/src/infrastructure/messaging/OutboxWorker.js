const { DEFAULT_OUTBOX_POLL_INTERVAL_MS, DEFAULT_OUTBOX_BATCH_SIZE } = require('../../config/env');

/**
 * Worker de publicación del Transactional Outbox hacia Apache Kafka.
 *
 * Responsabilidades:
 * - Ejecutar periódicamente `processBatch()` según `pollIntervalMs`.
 * - Leer eventos pendientes (`published_at IS NULL`) en lotes (`batchSize`) mediante `outboxRepository.processPendingBatch`
 *   (que utiliza `FOR UPDATE SKIP LOCKED` para concurrencia segura entre múltiples workers).
 * - Publicar el `payload` JSON almacenado en el `topic` de cada fila usando `aggregateId` como clave Kafka.
 * - Evitar dos ciclos simultáneos dentro del mismo proceso (`#isProcessing`).
 * - Capturar errores de infraestructura sin detener el proceso HTTP ni perder eventos.
 * - Permitir un cierre ordenado (`stop()`) esperando a que finalice el ciclo en curso.
 */
class OutboxWorker {
  /**
   * @param {{
   *   outboxRepository: import('../outbox/PgOutboxRepository'),
   *   kafkaPublisher: import('./KafkaEventPublisher'),
   *   pollIntervalMs?: number,
   *   batchSize?: number,
   *   logger?: Pick< Console, 'info' | 'warn' | 'error' >
   * }} deps
   */
  constructor({
    outboxRepository,
    kafkaPublisher,
    pollIntervalMs = DEFAULT_OUTBOX_POLL_INTERVAL_MS,
    batchSize = DEFAULT_OUTBOX_BATCH_SIZE,
    logger = console
  } = {}) {
    if (!outboxRepository) {
      throw new Error('OutboxWorker requires an outboxRepository.');
    }
    if (!kafkaPublisher) {
      throw new Error('OutboxWorker requires a kafkaPublisher.');
    }
    this.outboxRepository = outboxRepository;
    this.kafkaPublisher = kafkaPublisher;
    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
    this.logger = logger;

    this.#timer = null;
    this.#running = false;
    this.#currentCyclePromise = null;
  }

  #timer;
  #running;
  #currentCyclePromise;

  get isRunning() {
    return this.#running;
  }

  get isProcessing() {
    return this.#currentCyclePromise !== null;
  }

  /**
   * Procesa un lote de eventos pendientes en `outbox_events`.
   * Si ya hay un ciclo en ejecución dentro de este worker, devuelve la promesa en curso
   * para impedir ejecuciones solapadas en el mismo proceso.
   *
   * @returns {Promise<{ processed: number, published: number, failed: number, skipped?: boolean }>}
   */
  async processBatch() {
    if (this.#currentCyclePromise) {
      return { processed: 0, published: 0, failed: 0, skipped: true };
    }

    this.#currentCyclePromise = this.#executeCycle();
    try {
      return await this.#currentCyclePromise;
    } finally {
      this.#currentCyclePromise = null;
    }
  }

  async #executeCycle() {
    try {
      return await this.outboxRepository.processPendingBatch({
        limit: this.batchSize,
        publishOne: async (outboxEvent) => {
          await this.kafkaPublisher.publishMessage({
            topic: outboxEvent.topic,
            key: outboxEvent.aggregateId,
            value: outboxEvent.payload,
            headers: {
              eventId: String(outboxEvent.id),
              eventName: String(outboxEvent.eventName)
            }
          });
        }
      });
    } catch (err) {
      this.logger.warn(
        `[OutboxWorker] Error al procesar lote del Outbox: ${err?.message || err}`
      );
      return { processed: 0, published: 0, failed: 0 };
    }
  }

  /** Inicia la ejecución periódica del worker sin bloquear el hilo principal. */
  start() {
    if (this.#running) {
      return;
    }
    this.#running = true;
    this.#timer = setInterval(() => {
      void this.processBatch();
    }, this.pollIntervalMs);

    if (typeof this.#timer.unref === 'function') {
      this.#timer.unref();
    }
  }

  /**
   * Detiene el temporizador periódico y espera a que concluya cualquier lote en curso.
   */
  async stop() {
    this.#running = false;
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    if (this.#currentCyclePromise) {
      await this.#currentCyclePromise.catch(() => {});
    }
  }
}

module.exports = OutboxWorker;
