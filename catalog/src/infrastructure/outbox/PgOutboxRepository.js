const crypto = require('node:crypto');

const TOPIC_BY_EVENT = Object.freeze({
  ServiceCreated: 'catalog.service.created',
  ServiceUpdated: 'catalog.service.updated',
  ServicePriceChanged: 'catalog.service.price-changed',
  ServiceActivated: 'catalog.service.activated',
  ServiceDeactivated: 'catalog.service.deactivated'
});

function resolveTopic(eventName) {
  return TOPIC_BY_EVENT[eventName] || 'catalog.service.events';
}

function buildEnvelope(id, domainEvent) {
  const occurredAt =
    domainEvent.occurredAt instanceof Date
      ? domainEvent.occurredAt.toISOString()
      : new Date(domainEvent.occurredAt || Date.now()).toISOString();

  return {
    eventId: id,
    evento: domainEvent.name,
    eventVersion: 1,
    fechaEmision: occurredAt,
    aggregateId: domainEvent.aggregateId,
    origen: 'catalog-service',
    datos: domainEvent.payload
  };
}

function sanitizeErrorMessage(errorMessage) {
  const raw = String(errorMessage ?? 'Unknown publishing error');
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/(password|secret|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 1000);
}

function mapOutboxRow(row) {
  return {
    id: row.id,
    eventName: row.event_name,
    aggregateId: row.aggregate_id,
    topic: row.topic,
    payload: row.payload,
    createdAt: new Date(row.created_at),
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    attempts: Number(row.attempts),
    lastError: row.last_error
  };
}

/**
 * Repositorio PostgreSQL de la tabla `outbox_events` (patrón Transactional Outbox).
 * Permite insertar los eventos pendientes dentro de la misma transacción del agregado,
 * y posteriormente consultarlos, bloquearlos con `FOR UPDATE SKIP LOCKED` y actualizar
 * su estado para el publicador Kafka.
 */
class PgOutboxRepository {
  /**
   * @param {{ pool?: import('pg').Pool, client?: import('pg').PoolClient }} deps
   */
  constructor({ pool, client } = {}) {
    if (!pool && !client) {
      throw new Error('PgOutboxRepository requires a pg pool or client.');
    }
    this.pool = pool || null;
    this.client = client || null;
    this.queryable = client || pool;
  }

  /**
   * Inserta una lista de eventos de dominio en `outbox_events`.
   * @param {DomainEvent[]} events
   * @returns {Promise<object[]>}
   */
  async saveAll(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const inserted = [];
    for (const event of events) {
      const id = event.id || crypto.randomUUID();
      const topic = resolveTopic(event.name);
      const createdAt = event.occurredAt instanceof Date ? event.occurredAt : new Date();
      const envelope = buildEnvelope(id, event);

      const result = await this.queryable.query(
        `INSERT INTO outbox_events (
           id, event_name, aggregate_id, topic, payload, created_at, published_at, attempts, last_error
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NULL, 0, NULL)
         RETURNING *`,
        [id, event.name, event.aggregateId, topic, JSON.stringify(envelope), createdAt]
      );
      inserted.push(mapOutboxRow(result.rows[0]));
    }

    return inserted;
  }

  /**
   * Obtiene los eventos aún no publicados (`published_at IS NULL`), en orden de creación.
   * @param {{ limit?: number }} [options]
   */
  async findPending({ limit = 50 } = {}) {
    const result = await this.queryable.query(
      `SELECT *
         FROM outbox_events
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapOutboxRow);
  }

  /**
   * Reclama y procesa un lote de eventos pendientes utilizando `FOR UPDATE SKIP LOCKED`
   * registro por registro en transacciones cortas independientes:
   * - Dos workers concurrentes nunca bloquean ni publican el mismo evento al mismo tiempo.
   * - No se mantiene una transacción abierta durante la publicación de todo el lote.
   * - Cada evento se actualiza (`published_at` o `attempts` + `last_error`) inmediatamente antes del `COMMIT`,
   *   sin eliminar nunca registros de `outbox_events`.
   *
   * @param {{ limit?: number, publishOne: (event: object) => Promise<void> }} options
   * @returns {Promise<{ processed: number, published: number, failed: number }>}
   */
  async processPendingBatch({ limit = 50, publishOne }) {
    if (typeof publishOne !== 'function') {
      throw new Error('processPendingBatch requires a publishOne function.');
    }

    let processed = 0;
    let published = 0;
    let failed = 0;
    // Eventos ya intentados en este ciclo: un evento fallido no se vuelve a reclamar
    // hasta el siguiente ciclo (evita reintentos en bucle y bloqueo del resto del lote).
    const attemptedIds = [];

    for (let i = 0; i < limit; i += 1) {
      const { outcome, eventId } = await this.#claimAndProcessNext(publishOne, attemptedIds);
      if (outcome === 'empty') {
        break;
      }
      attemptedIds.push(eventId);
      processed += 1;
      if (outcome === 'published') {
        published += 1;
      } else {
        failed += 1;
      }
    }

    return { processed, published, failed };
  }

  async #claimAndProcessNext(publishOne, excludedIds) {
    const dedicatedClient = this.pool ? await this.pool.connect() : this.client;

    try {
      await dedicatedClient.query('BEGIN');

      // Solo es reclamable el evento pendiente más antiguo de cada agregado (NOT EXISTS):
      // así se conserva el orden por aggregateId aunque haya varios workers o fallos previos.
      const claimResult = await dedicatedClient.query(
        `SELECT *
           FROM outbox_events o
          WHERE o.published_at IS NULL
            AND NOT (o.id = ANY($1::uuid[]))
            AND NOT EXISTS (
              SELECT 1
                FROM outbox_events prev
               WHERE prev.aggregate_id = o.aggregate_id
                 AND prev.published_at IS NULL
                 AND prev.created_at < o.created_at
            )
          ORDER BY o.created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
        [excludedIds]
      );

      if (claimResult.rowCount === 0) {
        await dedicatedClient.query('COMMIT');
        return { outcome: 'empty' };
      }

      const event = mapOutboxRow(claimResult.rows[0]);

      try {
        await publishOne(event);
        await dedicatedClient.query(
          `UPDATE outbox_events
              SET published_at = $2,
                  attempts = attempts + 1,
                  last_error = NULL
            WHERE id = $1`,
          [event.id, new Date()]
        );
        await dedicatedClient.query('COMMIT');
        return { outcome: 'published', eventId: event.id };
      } catch (publishErr) {
        const safeMessage = sanitizeErrorMessage(publishErr?.message || publishErr);
        await dedicatedClient.query(
          `UPDATE outbox_events
              SET attempts = attempts + 1,
                  last_error = $2
            WHERE id = $1`,
          [event.id, safeMessage]
        );
        await dedicatedClient.query('COMMIT');
        return { outcome: 'failed', eventId: event.id };
      }
    } catch (txErr) {
      await dedicatedClient.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      if (this.pool && dedicatedClient) {
        dedicatedClient.release();
      }
    }
  }

  /** Marca un evento como publicado exitosamente. */
  async markPublished(id, publishedAt = new Date()) {
    const result = await this.queryable.query(
      `UPDATE outbox_events
          SET published_at = $2,
              attempts = attempts + 1,
              last_error = NULL
        WHERE id = $1
        RETURNING *`,
      [id, publishedAt]
    );
    return result.rows[0] ? mapOutboxRow(result.rows[0]) : null;
  }

  /** Registra un intento fallido de publicación junto con el mensaje de error sanitizado. */
  async recordFailure(id, errorMessage) {
    const safeMessage = sanitizeErrorMessage(errorMessage);
    const result = await this.queryable.query(
      `UPDATE outbox_events
          SET attempts = attempts + 1,
              last_error = $2
        WHERE id = $1
        RETURNING *`,
      [id, safeMessage]
    );
    return result.rows[0] ? mapOutboxRow(result.rows[0]) : null;
  }
}

module.exports = PgOutboxRepository;
module.exports.TOPIC_BY_EVENT = TOPIC_BY_EVENT;
module.exports.resolveTopic = resolveTopic;
module.exports.buildEnvelope = buildEnvelope;
module.exports.sanitizeErrorMessage = sanitizeErrorMessage;
