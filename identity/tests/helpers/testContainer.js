const { buildContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

const TEST_ADMIN = Object.freeze({
  email: 'admin@carwash.test',
  password: 'Admin12345',
  fullName: 'Admin de Pruebas'
});

function buildTestConfig(overrides = {}) {
  return Object.freeze({
    nodeEnv: 'test',
    port: 0,
    trustProxy: false,
    jwt: { secret: 'x'.repeat(48), expiresIn: '1h', issuer: 'carwash-identity', audience: 'carwash-platform' },
    // Costo mínimo de bcrypt para que las pruebas sean rápidas.
    bcryptRounds: 4,
    bootstrapAdmin: TEST_ADMIN,
    loginRateLimit: { max: 1000, windowMs: 60000 },
    ...overrides
  });
}

/** Publicador falso que guarda los eventos para poder verificarlos. */
class FakeEventPublisher {
  constructor() {
    this.events = [];
  }
  async publishAll(events) {
    this.events.push(...events);
  }
  names() {
    return this.events.map((event) => event.name);
  }
}

/** Contenedor + app listos, con el administrador inicial ya creado. */
async function buildTestApp(configOverrides) {
  const config = buildTestConfig(configOverrides);
  const eventPublisher = new FakeEventPublisher();
  const container = buildContainer({ config, eventPublisher });
  await container.commands.bootstrapAdmin.execute(config.bootstrapAdmin);
  const app = createApp(container, { logRequests: false });
  return { app, container, eventPublisher, config };
}

module.exports = { TEST_ADMIN, buildTestConfig, buildTestApp, FakeEventPublisher };
