const ServiceRepository = require('../../application/ports/ServiceRepository');
const WashService = require('../../domain/entities/WashService');
const Money = require('../../domain/value-objects/Money');
const {
  DuplicateServiceNameError,
  ConcurrencyConflictError,
  ServiceNotFoundError
} = require('../../application/errors/ApplicationErrors');
const PgOutboxRepository = require('../outbox/PgOutboxRepository');

const PG_UNIQUE_VIOLATION = '23505';

function mapRowToDomain(row) {
  const priceDecimal = Number.parseFloat(row.price);
  const priceCents = Money.fromDecimal(priceDecimal, row.currency.trim()).cents;

  return WashService.restore({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    priceCents,
    currency: row.currency.trim(),
    estimatedDuration: Number(row.estimated_duration),
    isActive: Boolean(row.is_active),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

/**
 * Implementación PostgreSQL de `ServiceRepository`.
 * Utiliza consultas SQL parametrizadas, control de concurrencia optimista mediante `version`
 * y soporte transaccional con `outbox_events`.
 */
class PgServiceRepository extends ServiceRepository {
  /**
   * @param {{ pool?: import('pg').Pool, client?: import('pg').PoolClient }} deps
   */
  constructor({ pool, client } = {}) {
    super();
    if (!pool && !client) {
      throw new Error('PgServiceRepository requires a pg pool or client.');
    }
    this.pool = pool || null;
    this.client = client || null;
  }

  get #queryable() {
    return this.client || this.pool;
  }

  /**
   * Inserta un servicio nuevo (`version === 1`) o actualiza uno existente verificando
   * la versión previa (`version = $8` donde `$8 = service.version - 1`).
   * Si otro proceso modificó el registro, lanza `ConcurrencyConflictError`.
   */
  async save(service, queryable = this.#queryable) {
    const priceDecimal = (service.priceCents / 100).toFixed(2);

    try {
      if (service.version === 1) {
        await queryable.query(
          `INSERT INTO wash_services (
             id, name, description, price, currency, estimated_duration, is_active, version, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            service.id,
            service.name,
            service.description,
            priceDecimal,
            service.currency,
            service.estimatedDuration,
            service.isActive,
            service.version,
            service.createdAt,
            service.updatedAt
          ]
        );
        return;
      }

      const expectedVersion = service.version - 1;
      const updateResult = await queryable.query(
        `UPDATE wash_services
            SET name = $2,
                description = $3,
                price = $4,
                currency = $5,
                estimated_duration = $6,
                is_active = $7,
                version = $8,
                updated_at = $9
          WHERE id = $1
            AND version = $10`,
        [
          service.id,
          service.name,
          service.description,
          priceDecimal,
          service.currency,
          service.estimatedDuration,
          service.isActive,
          service.version,
          service.updatedAt,
          expectedVersion
        ]
      );

      if (updateResult.rowCount === 0) {
        const existsResult = await queryable.query(
          'SELECT version FROM wash_services WHERE id = $1',
          [service.id]
        );
        if (existsResult.rowCount === 0) {
          throw new ServiceNotFoundError(service.id);
        }
        throw new ConcurrencyConflictError(service.id, expectedVersion);
      }
    } catch (err) {
      if (err && err.code === PG_UNIQUE_VIOLATION) {
        throw new DuplicateServiceNameError(service.name);
      }
      throw err;
    }
  }

  /**
   * Guarda el servicio y sus eventos pendientes en `outbox_events` dentro de una única
   * transacción PostgreSQL (`BEGIN` ... `COMMIT` / `ROLLBACK`).
   */
  async saveWithOutbox(service, events = []) {
    if (this.client) {
      await this.save(service, this.client);
      if (events.length > 0) {
        const outbox = new PgOutboxRepository({ client: this.client });
        await outbox.saveAll(events);
      }
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.save(service, client);
      if (events.length > 0) {
        const outbox = new PgOutboxRepository({ client });
        await outbox.saveAll(events);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id) {
    const result = await this.#queryable.query(
      'SELECT * FROM wash_services WHERE id = $1',
      [id]
    );
    return result.rows[0] ? mapRowToDomain(result.rows[0]) : null;
  }

  async findByName(name) {
    const normalized = String(name).trim();
    const result = await this.#queryable.query(
      'SELECT * FROM wash_services WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [normalized]
    );
    return result.rows[0] ? mapRowToDomain(result.rows[0]) : null;
  }

  async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    const result = await this.#queryable.query(
      'SELECT * FROM wash_services WHERE id = ANY($1::uuid[])',
      [ids]
    );
    return result.rows.map(mapRowToDomain);
  }

  /**
   * Lista servicios ordenados por `LOWER(name), name`.
   * Permite filtrar por `isActive` y paginar con `page` y `pageSize`.
   * - Si se especifica `page` o `pageSize`, devuelve `{ items, total, page, pageSize }`.
   * - Si no se especifica paginación, devuelve `WashService[]` para mantener compatibilidad.
   */
  async findAll({ isActive, page, pageSize } = {}) {
    const conditions = [];
    const params = [];

    if (isActive !== undefined) {
      params.push(Boolean(isActive));
      conditions.push(`is_active = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const hasPagination = page !== undefined || pageSize !== undefined;

    if (!hasPagination) {
      const result = await this.#queryable.query(
        `SELECT *
           FROM wash_services
           ${whereClause}
          ORDER BY LOWER(name) ASC, name ASC`,
        params
      );
      return result.rows.map(mapRowToDomain);
    }

    const resolvedPage = page === undefined ? 1 : Number(page);
    const resolvedPageSize = pageSize === undefined ? 20 : Number(pageSize);
    const offset = (resolvedPage - 1) * resolvedPageSize;

    const countResult = await this.#queryable.query(
      `SELECT COUNT(*)::int AS total FROM wash_services ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    const pageParams = [...params, resolvedPageSize, offset];
    const itemsResult = await this.#queryable.query(
      `SELECT *
         FROM wash_services
         ${whereClause}
        ORDER BY LOWER(name) ASC, name ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}`,
      pageParams
    );

    return {
      items: itemsResult.rows.map(mapRowToDomain),
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize
    };
  }
}

module.exports = PgServiceRepository;
