const UnitOfWork = require('../../application/ports/UnitOfWork');
const PgServiceRepository = require('../repositories/PgServiceRepository');
const PgOutboxRepository = require('../outbox/PgOutboxRepository');

/**
 * Implementación PostgreSQL de `UnitOfWork`.
 * Adquiere una única conexión del `pg.Pool`, inicia `BEGIN`, instancia repositorios
 * ligados a ese `PoolClient`, hace `COMMIT` si todo tiene éxito o `ROLLBACK` ante cualquier error,
 * y libera siempre el cliente en `finally`.
 */
class PgUnitOfWork extends UnitOfWork {
  /**
   * @param {{ pool: import('pg').Pool, createServiceRepository?: Function, createOutboxRepository?: Function }} deps
   */
  constructor({
    pool,
    createServiceRepository = (client) => new PgServiceRepository({ client }),
    createOutboxRepository = (client) => new PgOutboxRepository({ client })
  } = {}) {
    super();
    if (!pool) {
      throw new Error('PgUnitOfWork requires a pg pool.');
    }
    this.pool = pool;
    this.createServiceRepository = createServiceRepository;
    this.createOutboxRepository = createOutboxRepository;
  }

  async runInTransaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const serviceRepository = this.createServiceRepository(client);
      const outboxRepository = this.createOutboxRepository(client);

      const result = await work({ serviceRepository, outboxRepository, client });

      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = PgUnitOfWork;
