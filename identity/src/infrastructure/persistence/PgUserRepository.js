const UserRepository = require('../../application/ports/UserRepository');
const User = require('../../domain/entities/User');
const { ROLES } = require('../../domain/value-objects/Role');
const {
  ConcurrencyConflictError,
  EmailAlreadyRegisteredError,
  UserNotFoundError
} = require('../../application/errors/ApplicationErrors');

const UNIQUE_VIOLATION = '23505';
const COLUMNS = `id, email, full_name, password_hash, role, is_active, token_version, version,
  created_at, updated_at, last_login_at`;

function toUser(row) {
  return User.restore({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active,
    tokenVersion: row.token_version,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  });
}

/** Escapa los comodines de LIKE para que la búsqueda trate `%` y `_` como texto. */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Implementación PostgreSQL del puerto `UserRepository`.
 * Usa consultas parametrizadas ($1, $2...) en todos los casos, nunca concatena datos del usuario en el SQL.
 */
class PgUserRepository extends UserRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    super();
    if (!pool) {
      throw new Error('PgUserRepository requiere un pool de PostgreSQL.');
    }
    this.pool = pool;
  }

  async findById(id) {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  /**
   * Sin `expectedVersion` inserta un usuario nuevo.
   * Con `expectedVersion` actualiza solo si la versión guardada sigue siendo esa (concurrencia optimista).
   */
  async save(user, { expectedVersion = null } = {}) {
    const s = user.toSnapshot();
    try {
      if (expectedVersion === null) {
        await this.pool.query(
          `INSERT INTO users (${COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [s.id, s.email, s.fullName, s.passwordHash, s.role, s.isActive, s.tokenVersion, s.version,
            s.createdAt, s.updatedAt, s.lastLoginAt]
        );
        return;
      }

      const result = await this.pool.query(
        `UPDATE users
            SET email = $2, full_name = $3, password_hash = $4, role = $5, is_active = $6,
                token_version = $7, version = $8, updated_at = $9, last_login_at = $10
          WHERE id = $1 AND version = $11`,
        [s.id, s.email, s.fullName, s.passwordHash, s.role, s.isActive, s.tokenVersion, s.version,
          s.updatedAt, s.lastLoginAt, expectedVersion]
      );
      if (result.rowCount === 0) {
        const exists = await this.pool.query('SELECT 1 FROM users WHERE id = $1', [s.id]);
        throw exists.rowCount === 0 ? new UserNotFoundError(s.id) : new ConcurrencyConflictError(s.id);
      }
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION && err.constraint === 'uq_users_email') {
        throw new EmailAlreadyRegisteredError(s.email);
      }
      throw err;
    }
  }

  async findAll({ role, isActive, search, page, pageSize }) {
    const conditions = [];
    const params = [];
    if (role !== undefined) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      conditions.push(`is_active = $${params.length}`);
    }
    if (search !== undefined) {
      params.push(`%${escapeLike(search)}%`);
      conditions.push(`(email ILIKE $${params.length} OR full_name ILIKE $${params.length})`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await this.pool.query(`SELECT COUNT(*)::int AS total FROM users ${where}`, params);
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM users ${where}
        ORDER BY created_at ASC, id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { items: rows.map(toUser), total: totalResult.rows[0].total };
  }

  async count() {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS total FROM users');
    return rows[0].total;
  }

  async countActiveAdmins() {
    const { rows } = await this.pool.query(
      'SELECT COUNT(*)::int AS total FROM users WHERE role = $1 AND is_active = TRUE',
      [ROLES.ADMIN]
    );
    return rows[0].total;
  }
}

module.exports = PgUserRepository;
