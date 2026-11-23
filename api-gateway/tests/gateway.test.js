const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');

const SECRET = 'g'.repeat(48);
const FRONTEND = 'http://localhost:5173';

/** Microservicio falso: guarda lo que recibe y responde según la ruta, indicando qué servicio es. */
function startFakeService(name = 'identity', healthPath = '/health') {
  const received = [];
  const app = express();
  app.use(express.json());
  app.get(healthPath, (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/identity/users', (req, res) => {
    received.push(req);
    res.location('/api/identity/users/123').status(201).json({ id: '123', ...req.body });
  });
  app.get('/api/identity/conflict', (_req, res) => res.status(409).json({ error: { code: 'X_CONFLICT', message: 'conflicto' } }));
  app.get('/api/identity/slow', (_req, res) => setTimeout(() => res.json({ ok: true }), 500));
  app.use((req, res) => {
    received.push(req);
    res.set('X-Request-Id', 'del-servicio').set('Access-Control-Allow-Origin', '*');
    res.json({ service: name, method: req.method, url: req.originalUrl, body: req.body, headers: req.headers });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, received, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

/** Un puerto que estuvo abierto y se cerró: simula un servicio caído. */
function closedPortUrl() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}

/** Servicios falsos además de identity: nombre, variable de entorno y ruta de health. */
const OTHER_SERVICES = [
  ['catalog', 'CATALOG_SERVICE_URL', '/health'],
  ['customer', 'CUSTOMER_SERVICE_URL', '/health'],
  ['wash-order', 'WASH_ORDER_SERVICE_URL', '/health'],
  ['payment', 'PAYMENT_SERVICE_URL', '/api/payments/health'],
  ['notification', 'NOTIFICATION_SERVICE_URL', '/health']
];
const otherFakes = {};
const otherServiceEnv = {};

// Todas las URLs apuntan a servicios falsos: las pruebas nunca tocan servicios reales que estén corriendo.
function buildConfig(identityUrl, overrides = {}) {
  return loadConfig({
    JWT_SECRET: SECRET,
    ...otherServiceEnv,
    IDENTITY_SERVICE_URL: identityUrl,
    CORS_ORIGINS: FRONTEND,
    ...overrides
  });
}

function token(claims = {}, options = {}) {
  return jwt.sign({ role: 'ADMIN', tv: 0, ...claims }, options.secret || SECRET, {
    algorithm: 'HS256',
    subject: '11111111-1111-4111-8111-111111111111',
    issuer: 'carwash-identity',
    audience: 'carwash-platform',
    expiresIn: '1h',
    ...options.sign
  });
}

describe('API Gateway', () => {
  let fake;
  let app;

  beforeAll(async () => {
    for (const [name, envVar, healthPath] of OTHER_SERVICES) {
      otherFakes[name] = await startFakeService(name, healthPath);
      otherServiceEnv[envVar] = otherFakes[name].url;
    }
    fake = await startFakeService();
    app = createApp(buildConfig(fake.url), { logRequests: false });
  });

  afterAll(async () => {
    const servers = [fake, ...Object.values(otherFakes)].map((f) => f.server);
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });

  beforeEach(() => {
    fake.received.length = 0;
  });

  describe('Configuración', () => {
    it('exige JWT_SECRET robusto y URLs válidas', () => {
      expect(() => loadConfig({ JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
      expect(() => loadConfig({ JWT_SECRET: SECRET, IDENTITY_SERVICE_URL: 'no-es-url' })).toThrow(/IDENTITY_SERVICE_URL/);
      const config = loadConfig({ JWT_SECRET: SECRET });
      expect(config.port).toBe(8080);
      expect(config.services).toEqual({
        identity: 'http://localhost:3001',
        catalog: 'http://localhost:3002',
        customer: 'http://localhost:3005',
        washOrder: 'http://localhost:3000',
        payment: 'http://localhost:3003',
        notification: 'http://localhost:3004'
      });
      expect(config.corsOrigins).toEqual([FRONTEND]);
    });
  });

  describe('Health', () => {
    it('GET /health responde el estado del Gateway', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('api-gateway');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('GET /health/services responde 200 si los servicios están arriba y 503 si alguno cae', async () => {
      const up = await request(app).get('/health/services');
      expect(up.status).toBe(200);
      expect(up.body.services.map((s) => [s.service, s.status])).toEqual([
        ['identity', 'up'],
        ['catalog', 'up'],
        ['customer', 'up'],
        ['wash-order', 'up'],
        ['payment', 'up'],
        ['notification', 'up']
      ]);

      const downApp = createApp(buildConfig(await closedPortUrl()), { logRequests: false });
      const down = await request(downApp).get('/health/services');
      expect(down.status).toBe(503);
      expect(down.body.status).toBe('degraded');
      expect(down.body.services.filter((s) => s.status === 'down').map((s) => s.service)).toEqual(['identity']);
    });
  });

  describe('Todos los microservicios', () => {
    it('cada prefijo llega a su servicio con la ruta completa', async () => {
      const auth = `Bearer ${token()}`;
      const cases = [
        ['/api/identity/auth/me', 'identity'],
        ['/api/catalog/admin/services', 'catalog'],
        ['/api/customer/customers?search=ana', 'customer'],
        ['/api/orders/summary', 'wash-order'],
        ['/api/payments?orderId=abc', 'payment'],
        ['/api/notifications', 'notification']
      ];
      for (const [path, service] of cases) {
        const res = await request(app).get(path).set('Authorization', auth);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ service, url: path });
        expect(res.body.headers.authorization).toBe(auth);
      }
    });

    it('todas las rutas no públicas exigen token', async () => {
      const protectedRoutes = [
        ['get', '/api/catalog/admin/services'],
        ['post', '/api/catalog/admin/services'],
        ['get', '/api/customer/customers'],
        ['post', '/api/orders'],
        ['get', '/api/orders/summary'],
        ['post', '/api/payments'],
        ['get', '/api/payments'],
        ['get', '/api/notifications']
      ];
      for (const [method, path] of protectedRoutes) {
        const res = await request(app)[method](path);
        expect([method, path, res.status]).toEqual([method, path, 401]);
      }
    });

    it('las consultas públicas de catalog pasan sin token, también con :id', async () => {
      for (const path of ['/api/catalog/services', '/api/catalog/services/11111111-1111-4111-8111-111111111111']) {
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('catalog');
      }
      // El parámetro cubre un solo segmento: una subruta no queda pública por accidente.
      const deeper = await request(app).get('/api/catalog/services/123/otra-cosa');
      expect(deeper.status).toBe(401);
    });

    it('bloquea los endpoints internos de catalog y notification aunque haya token', async () => {
      const auth = `Bearer ${token()}`;
      const batch = await request(app).post('/api/catalog/services/batch').set('Authorization', auth).send({ ids: [] });
      expect(batch.status).toBe(404);
      const createNotification = await request(app).post('/api/notifications').set('Authorization', auth).send({});
      expect(createNotification.status).toBe(404);
      expect(otherFakes.catalog.received.filter((r) => r.method === 'POST')).toHaveLength(0);
      expect(otherFakes.notification.received.filter((r) => r.method === 'POST')).toHaveLength(0);
    });
  });

  describe('Enrutamiento y política de acceso', () => {
    it('la ruta pública de login pasa sin token y llega intacta al servicio', async () => {
      const res = await request(app)
        .post('/api/identity/auth/login?x=1')
        .set('X-Forwarded-For', '6.6.6.6')
        .send({ email: 'a@b.co', password: 'Clave1234' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ method: 'POST', url: '/api/identity/auth/login?x=1', body: { email: 'a@b.co' } });
      expect(res.body.headers['x-request-id']).toBe(res.headers['x-request-id']);
      expect(res.body.headers['x-forwarded-for']).not.toContain('6.6.6.6');
      expect(res.body.headers['x-forwarded-proto']).toBe('http');
      expect(res.body.headers.host).toBe(new URL(fake.url).host);
    });

    it('las rutas protegidas exigen un JWT válido antes de llegar al servicio', async () => {
      const cases = [
        [undefined, /Authorization/],
        ['Bearer basura', /inválido/],
        [`Bearer ${token({}, { secret: 'otro'.repeat(12) })}`, /inválido/],
        [`Bearer ${token({}, { sign: { audience: 'otra-app' } })}`, /inválido/],
        [`Bearer ${token({}, { sign: { expiresIn: -10 } })}`, /expiró/],
        [`Basic ${Buffer.from('a:b').toString('base64')}`, /Authorization/]
      ];
      for (const [authorization, message] of cases) {
        const req = request(app).get('/api/identity/auth/me');
        if (authorization) req.set('Authorization', authorization);
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.error).toMatchObject({ code: 'INVALID_TOKEN', message: expect.stringMatching(message) });
        expect(res.headers['www-authenticate']).toBe('Bearer');
      }
      expect(fake.received).toHaveLength(0);
    });

    it('con token válido reenvía la petición con el encabezado Authorization', async () => {
      const bearer = `Bearer ${token()}`;
      const res = await request(app).get('/api/identity/users?role=WASHER&isActive=true').set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.url).toBe('/api/identity/users?role=WASHER&isActive=true');
      expect(res.body.headers.authorization).toBe(bearer);
    });

    it('transmite estado, encabezados y cuerpo del servicio sin modificarlos', async () => {
      const auth = `Bearer ${token()}`;
      const created = await request(app)
        .post('/api/identity/users')
        .set('Authorization', auth)
        .send({ email: 'x@carwash.test' });
      expect(created.status).toBe(201);
      expect(created.headers.location).toBe('/api/identity/users/123');
      expect(created.body).toEqual({ id: '123', email: 'x@carwash.test' });

      const conflict = await request(app).get('/api/identity/conflict').set('Authorization', auth);
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe('X_CONFLICT');
    });

    it('el Gateway define X-Request-Id y CORS, no el servicio', async () => {
      const res = await request(app).get('/api/identity/auth/me').set('Authorization', `Bearer ${token()}`).set('X-Request-Id', 'mi-id-123');
      expect(res.headers['x-request-id']).toBe('mi-id-123');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('no expone el endpoint interno /auth/verify ni rutas desconocidas', async () => {
      const verify = await request(app).post('/api/identity/auth/verify').send({ token: 'x' });
      expect(verify.status).toBe(404);
      expect(fake.received).toHaveLength(0);

      for (const path of ['/api/otro-servicio/algo', '/api', '/no-existe', '/api/identityX/auth/login']) {
        const res = await request(app).get(path);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('Resiliencia', () => {
    it('responde 503 si el servicio está caído', async () => {
      const downApp = createApp(buildConfig(await closedPortUrl()), { logRequests: false });
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(downApp).post('/api/identity/auth/login').send({});
      spy.mockRestore();
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('responde 504 si el servicio no contesta a tiempo', async () => {
      const slowApp = createApp(buildConfig(fake.url, { PROXY_TIMEOUT_MS: '100' }), { logRequests: false });
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(slowApp).get('/api/identity/slow').set('Authorization', `Bearer ${token()}`);
      spy.mockRestore();
      expect(res.status).toBe(504);
      expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
    });
  });

  describe('CORS y límite de solicitudes', () => {
    it('acepta el preflight del frontend sin token y rechaza otros orígenes', async () => {
      const preflight = await request(app)
        .options('/api/identity/auth/me')
        .set('Origin', FRONTEND)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(FRONTEND);
      expect(preflight.headers['access-control-allow-headers']).toMatch(/Authorization/);

      const login = await request(app).post('/api/identity/auth/login').set('Origin', FRONTEND).send({});
      expect(login.headers['access-control-allow-origin']).toBe(FRONTEND);

      const evil = await request(app).get('/health').set('Origin', 'http://sitio-malicioso.com');
      expect(evil.status).toBe(403);
      expect(evil.body.error.code).toBe('CORS_NOT_ALLOWED');
    });

    it('limita las solicitudes por IP con 429', async () => {
      const limited = createApp(buildConfig(fake.url, { RATE_LIMIT_MAX: '2' }), { logRequests: false });
      await request(limited).get('/health');
      await request(limited).get('/health');
      const res = await request(limited).get('/health');
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });
});
