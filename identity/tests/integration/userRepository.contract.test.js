require('dotenv').config({ quiet: true });

const crypto = require('node:crypto');
const request = require('supertest');
const User = require('../../src/domain/entities/User');
const InMemoryUserRepository = require('../../src/infrastructure/persistence/InMemoryUserRepository');
const PgUserRepository = require('../../src/infrastructure/persistence/PgUserRepository');
const { createPool, verifyDatabaseConnection } = require('../../src/infrastructure/database/pool');
const { runMigrations } = require('../../src/infrastructure/database/migrate');
const { buildContainer } = require('../../src/container');
const { createApp } = require('../../src/app');
const { buildTestConfig, FakeEventPublisher, TEST_ADMIN } = require('../helpers/testContainer');

let seq = 0;
function makeUser({ email, role = 'WASHER', fullName = 'Usuario Prueba' } = {}) {
  seq += 1;
  return User.register({
    id: crypto.randomUUID(),
    email: email || `user${seq}@carwash.test`,
    fullName,
    passwordHash: '$2a$04$hashdeprueba',
    role,
    now: new Date(Date.UTC(2026, 0, 1, 0, 0, seq))
  });
}

/**
 * Contrato del puerto UserRepository: ambas implementaciones deben comportarse igual.
 * Así los casos de uso no notan si los datos están en memoria o en PostgreSQL.
 */
function describeRepositoryContract(name, setup) {
  describe(`UserRepository: ${name}`, () => {
    let repo;
    beforeEach(async () => {
      repo = await setup.fresh();
    });

    it('inserta y recupera por id y por correo con todos los campos', async () => {
      const user = makeUser({ email: 'ana@carwash.test', role: 'RECEPTIONIST' });
      await repo.save(user);

      const byId = await repo.findById(user.id);
      expect(byId.toSnapshot()).toEqual(user.toSnapshot());
      expect((await repo.findByEmail('ana@carwash.test')).id).toBe(user.id);
      expect(await repo.findByEmail('nadie@carwash.test')).toBeNull();
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });

    it('rechaza un correo duplicado', async () => {
      await repo.save(makeUser({ email: 'dup@carwash.test' }));
      await expect(repo.save(makeUser({ email: 'dup@carwash.test' }))).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED'
      });
    });

    it('actualiza con la versión esperada y detecta escrituras concurrentes', async () => {
      const user = makeUser();
      await repo.save(user);

      const first = await repo.findById(user.id);
      const second = await repo.findById(user.id);

      first.changeRole('RECEPTIONIST');
      await repo.save(first, { expectedVersion: 1 });
      expect((await repo.findById(user.id)).role).toBe('RECEPTIONIST');

      second.deactivate();
      await expect(repo.save(second, { expectedVersion: 1 })).rejects.toMatchObject({ code: 'CONCURRENCY_CONFLICT' });
    });

    it('actualizar un usuario inexistente lanza USER_NOT_FOUND', async () => {
      const ghost = makeUser();
      await expect(repo.save(ghost, { expectedVersion: 1 })).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    });

    it('filtra, busca, ordena por fecha de creación y pagina', async () => {
      await repo.save(makeUser({ email: 'a@carwash.test', fullName: 'Carlos Mamani', role: 'WASHER' }));
      await repo.save(makeUser({ email: 'b@carwash.test', fullName: 'Maria Lopez', role: 'RECEPTIONIST' }));
      const inactive = makeUser({ email: 'c@carwash.test', fullName: 'Jose Quispe', role: 'WASHER' });
      inactive.deactivate();
      await repo.save(inactive);

      const washers = await repo.findAll({ role: 'WASHER', isActive: true, page: 1, pageSize: 10 });
      expect(washers.total).toBe(1);
      expect(washers.items[0].fullName).toBe('Carlos Mamani');

      const search = await repo.findAll({ search: 'lopez', page: 1, pageSize: 10 });
      expect(search.items.map((u) => u.email)).toEqual(['b@carwash.test']);

      const literalPercent = await repo.findAll({ search: '%', page: 1, pageSize: 10 });
      expect(literalPercent.total).toBe(0);

      const page2 = await repo.findAll({ page: 2, pageSize: 2 });
      expect(page2.total).toBe(3);
      expect(page2.items.map((u) => u.email)).toEqual(['c@carwash.test']);
    });

    it('cuenta usuarios y administradores activos', async () => {
      expect(await repo.count()).toBe(0);
      await repo.save(makeUser({ role: 'ADMIN' }));
      const inactiveAdmin = makeUser({ role: 'ADMIN' });
      inactiveAdmin.deactivate();
      await repo.save(inactiveAdmin);
      await repo.save(makeUser({ role: 'WASHER' }));

      expect(await repo.count()).toBe(3);
      expect(await repo.countActiveAdmins()).toBe(1);
    });
  });
}

describeRepositoryContract('InMemoryUserRepository', {
  fresh: async () => new InMemoryUserRepository()
});

const describePg = process.env.DATABASE_URL ? describe : describe.skip;

describePg('PostgreSQL (identity_db, schema temporal)', () => {
  // Schema aislado por ejecución: nunca toca las tablas de `public`.
  const schema = `identity_test_${process.pid}_${Date.now()}`;
  let pool;

  beforeAll(async () => {
    pool = createPool({ connectionString: process.env.DATABASE_URL, max: 4, schema });
    await verifyDatabaseConnection(pool);
    await runMigrations({ pool, schema });
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  });

  const truncate = () => pool.query('TRUNCATE TABLE users');

  it('las migraciones son idempotentes', async () => {
    const again = await runMigrations({ pool, schema });
    expect(again.applied).toEqual([]);
    expect(again.skipped).toContain('001_create_users_table.sql');
  });

  it('la base rechaza datos que violan las restricciones aunque se salten el dominio', async () => {
    await truncate();
    await expect(
      pool.query(
        `INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
         VALUES ($1, 'x@carwash.test', 'Nombre', 'h', 'SUPERUSER', now(), now())`,
        [crypto.randomUUID()]
      )
    ).rejects.toThrow(/chk_users_role/);
    await expect(
      pool.query(
        `INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
         VALUES ($1, 'MAYUS@carwash.test', 'Nombre', 'h', 'WASHER', now(), now())`,
        [crypto.randomUUID()]
      )
    ).rejects.toThrow(/chk_users_email_lowercase/);
  });

  describeRepositoryContract('PgUserRepository', {
    fresh: async () => {
      await truncate();
      return new PgUserRepository({ pool });
    }
  });

  it('flujo HTTP completo persistido en PostgreSQL', async () => {
    await truncate();
    const config = buildTestConfig();
    const container = buildContainer({
      config,
      repository: new PgUserRepository({ pool }),
      eventPublisher: new FakeEventPublisher()
    });
    await container.commands.bootstrapAdmin.execute(config.bootstrapAdmin);
    const app = createApp(container, { logRequests: false });

    const login = await request(app).post('/api/identity/auth/login').send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const created = await request(app)
      .post('/api/identity/users')
      .set(auth)
      .send({ email: 'lavador@carwash.test', fullName: 'Carlos Mamani', password: 'Lavador123', role: 'WASHER' });
    expect(created.status).toBe(201);

    const off = await request(app).patch(`/api/identity/users/${created.body.id}/deactivate`).set(auth);
    expect(off.body.isActive).toBe(false);

    const { rows } = await pool.query('SELECT is_active, token_version, version, password_hash FROM users WHERE id = $1', [created.body.id]);
    expect(rows[0]).toMatchObject({ is_active: false, token_version: 1, version: 2 });
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);

    const admin = await pool.query('SELECT last_login_at FROM users WHERE email = $1', [TEST_ADMIN.email]);
    expect(admin.rows[0].last_login_at).not.toBeNull();
  });
});
