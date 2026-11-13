require('dotenv').config({ quiet: true });

const DEFAULT_PORT = 3002;
const DEFAULT_OUTBOX_POLL_INTERVAL_MS = 5000;
const DEFAULT_OUTBOX_BATCH_SIZE = 50;

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalDevRole(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const devAuthRole = nodeEnv === 'production' ? null : parseOptionalDevRole(env.DEV_AUTH_ROLE);

  return Object.freeze({
    nodeEnv,
    port: parsePort(env.PORT),
    databaseUrl: env.DATABASE_URL || null,
    devAuthRole,
    kafka: Object.freeze({
      brokers: (env.KAFKA_BROKERS || 'localhost:9092')
        .split(',')
        .map((broker) => broker.trim())
        .filter(Boolean),
      clientId: env.KAFKA_CLIENT_ID || 'catalog-service',
      groupId: env.KAFKA_GROUP_ID || 'catalog-service-group'
    }),
    outbox: Object.freeze({
      pollIntervalMs: parsePositiveInteger(
        env.OUTBOX_POLL_INTERVAL_MS,
        DEFAULT_OUTBOX_POLL_INTERVAL_MS
      ),
      batchSize: parsePositiveInteger(env.OUTBOX_BATCH_SIZE, DEFAULT_OUTBOX_BATCH_SIZE)
    })
  });
}

module.exports = {
  DEFAULT_PORT,
  DEFAULT_OUTBOX_POLL_INTERVAL_MS,
  DEFAULT_OUTBOX_BATCH_SIZE,
  loadConfig,
  config: loadConfig()
};
