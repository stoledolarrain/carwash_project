const request = require('supertest');
const { buildTestApp, TEST_ADMIN } = require('../helpers/testContainer');

const WASHER = { email: 'carlos@carwash.test', fullName: 'Carlos Mamani', password: 'Lavador123', role: 'WASHER' };

async function login(app, email, password) {
  return request(app).post('/api/identity/auth/login').send({ email, password });
}

async function adminToken(app) {
  const res = await login(app, TEST_ADMIN.email, TEST_ADMIN.password);
  return res.body.accessToken;
}

async function createWasher(app, token, overrides = {}) {
  return request(app)
    .post('/api/identity/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...WASHER, ...overrides });
}

describe('Identity API', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await buildTestApp();
  });

  describe('Health', () => {
    it('GET /health responde 200 y un X-Request-Id', async () => {
      const res = await request(ctx.app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', service: 'identity-service' });
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Login', () => {
    it('devuelve un JWT y el usuario sin datos sensibles', async () => {
      const res = await login(ctx.app, 'ADMIN@carwash.test', TEST_ADMIN.password);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: '1h' });
      expect(res.body.accessToken.split('.')).toHaveLength(3);
      expect(res.body.user).toMatchObject({ email: TEST_ADMIN.email, role: 'ADMIN', isActive: true });
      expect(res.body.user.lastLoginAt).not.toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
    });

    it('responde el mismo 401 si el correo no existe o la contraseña es incorrecta', async () => {
      const wrongPassword = await login(ctx.app, TEST_ADMIN.email, 'Incorrecta123');
      const unknownEmail = await login(ctx.app, 'nadie@carwash.test', 'Incorrecta123');
      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        expect(res.headers['www-authenticate']).toBe('Bearer');
      }
    });

    it('valida el cuerpo: 400 con detalles, campos desconocidos y JSON roto', async () => {
      const missing = await request(ctx.app).post('/api/identity/auth/login').send({ email: 'a@b.co' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.details).toEqual([{ field: 'password', message: expect.any(String) }]);

      const extra = await request(ctx.app)
        .post('/api/identity/auth/login')
        .send({ email: 'a@b.co', password: 'x', role: 'ADMIN' });
      expect(extra.status).toBe(400);

      const broken = await request(ctx.app)
        .post('/api/identity/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email":');
      expect(broken.status).toBe(400);
      expect(broken.body.error.code).toBe('INVALID_JSON');
    });

    it('limita los intentos por IP con 429', async () => {
      const limited = await buildTestApp({ loginRateLimit: { max: 2, windowMs: 60000 } });
      await login(limited.app, 'x@carwash.test', 'Clave1234');
      await login(limited.app, 'x@carwash.test', 'Clave1234');
      const res = await login(limited.app, 'x@carwash.test', 'Clave1234');
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('Autenticación y autorización', () => {
    it('GET /auth/me exige token y devuelve el perfil', async () => {
      expect((await request(ctx.app).get('/api/identity/auth/me')).status).toBe(401);
      expect(
        (await request(ctx.app).get('/api/identity/auth/me').set('Authorization', 'Bearer basura')).status
      ).toBe(401);

      const token = await adminToken(ctx.app);
      const res = await request(ctx.app).get('/api/identity/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(TEST_ADMIN.email);
    });

    it('ignora encabezados falsificados como X-User-Role', async () => {
      const res = await request(ctx.app).get('/api/identity/users').set('X-User-Role', 'ADMIN');
      expect(res.status).toBe(401);
    });

    it('un usuario no administrador recibe 403 en /users', async () => {
      const token = await adminToken(ctx.app);
      await createWasher(ctx.app, token);
      const washerToken = (await login(ctx.app, WASHER.email, WASHER.password)).body.accessToken;

      const res = await request(ctx.app).get('/api/identity/users').set('Authorization', `Bearer ${washerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('POST /auth/verify valida tokens para el API Gateway (body o header)', async () => {
      const token = await adminToken(ctx.app);
      const byBody = await request(ctx.app).post('/api/identity/auth/verify').send({ token });
      expect(byBody.status).toBe(200);
      expect(byBody.body).toMatchObject({ valid: true, role: 'ADMIN', email: TEST_ADMIN.email });
      expect(byBody.body.permissions).toContain('users:manage');

      const byHeader = await request(ctx.app).post('/api/identity/auth/verify').set('Authorization', `Bearer ${token}`);
      expect(byHeader.status).toBe(200);

      const invalid = await request(ctx.app).post('/api/identity/auth/verify').send({ token: 'no.es.valido' });
      expect(invalid.status).toBe(401);
      expect(invalid.body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /roles lista roles y permisos', async () => {
      const token = await adminToken(ctx.app);
      const res = await request(ctx.app).get('/api/identity/roles').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.items.map((r) => r.role)).toEqual(['ADMIN', 'RECEPTIONIST', 'WASHER']);
    });
  });

  describe('Gestión de usuarios (ADMIN)', () => {
    it('crea un usuario (201 + Location) y emite UserRegistered', async () => {
      const token = await adminToken(ctx.app);
      const res = await createWasher(ctx.app, token, { email: 'CARLOS@carwash.test', role: 'washer' });
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/identity/users/${res.body.id}`);
      expect(res.body).toMatchObject({ email: 'carlos@carwash.test', role: 'WASHER', isActive: true });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(ctx.eventPublisher.names()).toEqual(['UserRegistered', 'UserRegistered']);
    });

    it('rechaza correo duplicado (409), contraseña débil y rol inválido (400)', async () => {
      const token = await adminToken(ctx.app);
      await createWasher(ctx.app, token);

      const duplicate = await createWasher(ctx.app, token, { email: 'Carlos@CarWash.test' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

      const weak = await createWasher(ctx.app, token, { email: 'otro@carwash.test', password: 'abcdefgh' });
      expect(weak.status).toBe(400);
      expect(weak.body.error.code).toBe('WEAK_PASSWORD');

      const badRole = await createWasher(ctx.app, token, { email: 'otro@carwash.test', role: 'ROOT' });
      expect(badRole.status).toBe(400);
      expect(badRole.body.error.details[0].field).toBe('role');
    });

    it('lista con filtros y paginación, y consulta por id', async () => {
      const token = await adminToken(ctx.app);
      const created = (await createWasher(ctx.app, token)).body;
      await createWasher(ctx.app, token, { email: 'maria@carwash.test', fullName: 'Maria Lopez', role: 'RECEPTIONIST' });

      const washers = await request(ctx.app)
        .get('/api/identity/users?role=WASHER&isActive=true')
        .set('Authorization', `Bearer ${token}`);
      expect(washers.status).toBe(200);
      expect(washers.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(washers.body.items[0].id).toBe(created.id);

      const search = await request(ctx.app)
        .get('/api/identity/users?search=maria&page=1&pageSize=1')
        .set('Authorization', `Bearer ${token}`);
      expect(search.body.items.map((u) => u.fullName)).toEqual(['Maria Lopez']);

      const badQuery = await request(ctx.app)
        .get('/api/identity/users?isActive=quizas')
        .set('Authorization', `Bearer ${token}`);
      expect(badQuery.status).toBe(400);

      const byId = await request(ctx.app).get(`/api/identity/users/${created.id}`).set('Authorization', `Bearer ${token}`);
      expect(byId.status).toBe(200);

      const notFound = await request(ctx.app)
        .get('/api/identity/users/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${token}`);
      expect(notFound.status).toBe(404);
      expect(notFound.body.error.code).toBe('USER_NOT_FOUND');

      const badId = await request(ctx.app).get('/api/identity/users/123').set('Authorization', `Bearer ${token}`);
      expect(badId.status).toBe(400);
    });

    it('actualiza perfil y cambia rol; el cambio de rol revoca el token anterior', async () => {
      const token = await adminToken(ctx.app);
      const washer = (await createWasher(ctx.app, token)).body;
      const washerToken = (await login(ctx.app, WASHER.email, WASHER.password)).body.accessToken;

      const profile = await request(ctx.app)
        .patch(`/api/identity/users/${washer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Carlos Mamani Quispe' });
      expect(profile.status).toBe(200);
      expect(profile.body.fullName).toBe('Carlos Mamani Quispe');

      const role = await request(ctx.app)
        .patch(`/api/identity/users/${washer.id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'RECEPTIONIST' });
      expect(role.status).toBe(200);
      expect(role.body.role).toBe('RECEPTIONIST');
      expect(role.body.permissions).toContain('payments:register');

      const revoked = await request(ctx.app).get('/api/identity/auth/me').set('Authorization', `Bearer ${washerToken}`);
      expect(revoked.status).toBe(401);
      expect(ctx.eventPublisher.names()).toEqual(
        expect.arrayContaining(['UserProfileUpdated', 'UserRoleChanged'])
      );
    });

    it('desactivar bloquea el login (403) y revoca tokens; activar lo restablece', async () => {
      const token = await adminToken(ctx.app);
      const washer = (await createWasher(ctx.app, token)).body;
      const washerToken = (await login(ctx.app, WASHER.email, WASHER.password)).body.accessToken;

      const off = await request(ctx.app)
        .patch(`/api/identity/users/${washer.id}/deactivate`)
        .set('Authorization', `Bearer ${token}`);
      expect(off.status).toBe(200);
      expect(off.body.isActive).toBe(false);

      expect((await request(ctx.app).get('/api/identity/auth/me').set('Authorization', `Bearer ${washerToken}`)).status).toBe(401);
      const blocked = await login(ctx.app, WASHER.email, WASHER.password);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('ACCOUNT_DISABLED');

      const on = await request(ctx.app)
        .patch(`/api/identity/users/${washer.id}/activate`)
        .set('Authorization', `Bearer ${token}`);
      expect(on.body.isActive).toBe(true);
      expect((await login(ctx.app, WASHER.email, WASHER.password)).status).toBe(200);
    });

    it('protege al último administrador y no permite autodesactivarse ni cambiarse el rol', async () => {
      const token = await adminToken(ctx.app);
      const me = (await request(ctx.app).get('/api/identity/auth/me').set('Authorization', `Bearer ${token}`)).body;

      const selfOff = await request(ctx.app)
        .patch(`/api/identity/users/${me.id}/deactivate`)
        .set('Authorization', `Bearer ${token}`);
      expect(selfOff.status).toBe(403);
      expect(selfOff.body.error.code).toBe('FORBIDDEN_OPERATION');

      const selfRole = await request(ctx.app)
        .patch(`/api/identity/users/${me.id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'WASHER' });
      expect(selfRole.status).toBe(403);

      // Un segundo admin intenta degradar al primero cuando es el único otro admin activo: permitido.
      // Pero si solo queda uno, se rechaza con 409 LAST_ADMIN.
      const second = (await createWasher(ctx.app, token, { email: 'admin2@carwash.test', role: 'ADMIN' })).body;
      const secondToken = (await login(ctx.app, 'admin2@carwash.test', WASHER.password)).body.accessToken;
      const demoteFirst = await request(ctx.app)
        .patch(`/api/identity/users/${me.id}/role`)
        .set('Authorization', `Bearer ${secondToken}`)
        .send({ role: 'RECEPTIONIST' });
      expect(demoteFirst.status).toBe(200);

      const { container } = ctx;
      await expect(
        container.commands.deactivateUser.execute({ actorId: me.id, userId: second.id })
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    });

    it('PATCH /:id/password permite al admin restablecer la contraseña', async () => {
      const token = await adminToken(ctx.app);
      const washer = (await createWasher(ctx.app, token)).body;
      const res = await request(ctx.app)
        .patch(`/api/identity/users/${washer.id}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'NuevaClave2026' });
      expect(res.status).toBe(200);
      expect((await login(ctx.app, WASHER.email, WASHER.password)).status).toBe(401);
      expect((await login(ctx.app, WASHER.email, 'NuevaClave2026')).status).toBe(200);
    });
  });

  describe('Cambio de contraseña propia', () => {
    it('exige la contraseña actual, revoca el token y permite entrar con la nueva', async () => {
      const token = await adminToken(ctx.app);

      const wrong = await request(ctx.app)
        .patch('/api/identity/auth/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'NoEsLaActual1', newPassword: 'OtraClave2026' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('INCORRECT_CURRENT_PASSWORD');

      const ok = await request(ctx.app)
        .patch('/api/identity/auth/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: TEST_ADMIN.password, newPassword: 'OtraClave2026' });
      expect(ok.status).toBe(200);

      expect((await request(ctx.app).get('/api/identity/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
      expect((await login(ctx.app, TEST_ADMIN.email, 'OtraClave2026')).status).toBe(200);
    });
  });

  it('rutas inexistentes responden 404 con formato uniforme', async () => {
    const res = await request(ctx.app).get('/api/identity/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
