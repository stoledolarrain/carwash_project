require('dotenv').config();

const DEFAULT_PORT = 3002;

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

function loadConfig(env = process.env) {
  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    databaseUrl: env.DATABASE_URL || null,
    kafka: Object.freeze({
      brokers: (env.KAFKA_BROKERS || 'localhost:9092')
        .split(',')
        .map((broker) => broker.trim())
        .filter(Boolean),
      clientId: env.KAFKA_CLIENT_ID || 'catalog-service',
      groupId: env.KAFKA_GROUP_ID || 'catalog-service-group'
    })
  });
}

module.exports = { loadConfig, config: loadConfig() };
