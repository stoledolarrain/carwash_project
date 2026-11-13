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
 * y posteriormente consultarlos y actualizar su estado para el publicador Kafka (Paso 8).
 */
class PgOutboxRepository {
  /**
   * @param {{ pool?: import('pg').Pool, client?: import('pg').PoolClient }} deps
   */
  constructor({ pool, client } = {}) {
    if (!pool && !client) {
      throw new Error('PgOutboxRepository requires a pg pool or client.');
    }
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

  /** Registra un intento fallido de publicación junto con el mensaje de error. */
  async recordFailure(id, errorMessage) {
    const result = await this.queryable.query(
      `UPDATE outbox_events
          SET attempts = attempts + 1,
              last_error = $2
        WHERE id = $1
        RETURNING *`,
      [id, String(errorMessage)]
    );
    return result.rows[0] ? mapOutboxRow(result.rows[0]) : null;
  }
}

module.exports = PgOutboxRepository;
module.exports.TOPIC_BY_EVENT = TOPIC_BY_EVENT;
module.exports.resolveTopic = resolveTopic;
