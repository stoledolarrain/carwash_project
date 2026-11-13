const { loadConfig } = require('../../src/config/env');

describe('loadConfig', () => {
  it('usa valores por defecto (puerto 3002, outbox poll 5000ms y batch 50)', () => {
    const cfg = loadConfig({});

    expect(cfg.port).toBe(3002);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.databaseUrl).toBeNull();
    expect(cfg.devAuthRole).toBeNull();
    expect(cfg.kafka.brokers).toEqual(['localhost:9092']);
    expect(cfg.outbox).toEqual({ pollIntervalMs: 5000, batchSize: 50 });
  });

  it('lee variables de entorno y separa los brokers', () => {
    const cfg = loadConfig({
      PORT: '4000',
      KAFKA_BROKERS: 'a:9092, b:9092',
      OUTBOX_POLL_INTERVAL_MS: '1500',
      OUTBOX_BATCH_SIZE: '25',
      DEV_AUTH_ROLE: 'admin'
    });

    expect(cfg.port).toBe(4000);
    expect(cfg.devAuthRole).toBe('ADMIN');
    expect(cfg.kafka.brokers).toEqual(['a:9092', 'b:9092']);
    expect(cfg.outbox).toEqual({ pollIntervalMs: 1500, batchSize: 25 });
  });

  it('desactiva DEV_AUTH_ROLE automáticamente cuando NODE_ENV=production', () => {
    const cfg = loadConfig({ NODE_ENV: 'production', DEV_AUTH_ROLE: 'ADMIN' });

    expect(cfg.devAuthRole).toBeNull();
  });

  it('ignora un puerto o parámetros de outbox inválidos', () => {
    const cfg = loadConfig({
      PORT: 'abc',
      OUTBOX_POLL_INTERVAL_MS: '-10',
      OUTBOX_BATCH_SIZE: '0'
    });

    expect(cfg.port).toBe(3002);
    expect(cfg.outbox).toEqual({ pollIntervalMs: 5000, batchSize: 50 });
  });
});
