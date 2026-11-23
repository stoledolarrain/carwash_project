'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { buildContainer } = require('../../src/container');
const { createJwtAuthContextMiddleware } = require('../../src/infrastructure/security/jwtAuthContext');
const InMemoryServiceRepository = require('../helpers/InMemoryServiceRepository');
const FakeEventPublisher = require('../helpers/FakeEventPublisher');

const JWT_CONFIG = { secret: 'c'.repeat(48), issuer: 'carwash-identity', audience: 'carwash-platform' };

function token(role = 'ADMIN', { secret = JWT_CONFIG.secret, ...signOptions } = {}) {
  return jwt.sign({ role, tv: 0 }, secret, {
    algorithm: 'HS256',
    subject: '11111111-1111-4111-8111-111111111111',
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    expiresIn: '1h',
    ...signOptions
  });
}

function buildApp() {
  const container = buildContainer({
    repository: new InMemoryServiceRepository(),
    eventPublisher: new FakeEventPublisher()
  });
  return createApp(container, { authContextMiddleware: createJwtAuthContextMiddleware(JWT_CONFIG) });
}

const NEW_SERVICE = { name: 'Lavado JWT', description: 'Servicio de prueba', price: 45, estimatedDuration: 35 };

describe('Autenticación JWT de Identity Service en Catalog', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
  });

  it('rechaza crear el middleware con un secreto corto', () => {
    expect(() => createJwtAuthContextMiddleware({ ...JWT_CONFIG, secret: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('un token ADMIN válido permite usar las rutas administrativas', async () => {
    const res = await request(app)
      .post('/api/catalog/admin/services')
      .set('Authorization', `Bearer ${token('ADMIN')}`)
      .send(NEW_SERVICE);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Lavado JWT');
  });

  it('un token válido con otro rol recibe 403', async () => {
    for (const role of ['RECEPTIONIST', 'WASHER']) {
      const res = await request(app).get('/api/catalog/admin/services').set('Authorization', `Bearer ${token(role)}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('sin token las rutas administrativas responden 401 y las públicas funcionan', async () => {
    const admin = await request(app).get('/api/catalog/admin/services');
    expect(admin.status).toBe(401);

    const publicList = await request(app).get('/api/catalog/services');
    expect(publicList.status).toBe(200);
  });

  it('tokens inválidos, vencidos, de otra audiencia o con rol desconocido responden 401', async () => {
    const invalid = [
      'Bearer basura',
      `Bearer ${token('ADMIN', { secret: 'otro-secreto'.repeat(4) })}`,
      `Bearer ${token('ADMIN', { expiresIn: -10 })}`,
      `Bearer ${token('ADMIN', { audience: 'otra-app' })}`,
      `Bearer ${token('SUPERUSER')}`,
      'Basic dXNlcjpwYXNz'
    ];
    for (const authorization of invalid) {
      const res = await request(app).get('/api/catalog/services').set('Authorization', authorization);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('ignora encabezados falsificados como X-User-Role', async () => {
    const res = await request(app).get('/api/catalog/admin/services').set('X-User-Role', 'ADMIN');
    expect(res.status).toBe(401);
  });
});
