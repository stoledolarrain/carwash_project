const { loadConfig } = require('../../src/config/env');

describe('loadConfig', () => {
  it('usa valores por defecto (puerto 3002)', () => {
    const cfg = loadConfig({});

    expect(cfg.port).toBe(3002);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.databaseUrl).toBeNull();
    expect(cfg.kafka.brokers).toEqual(['localhost:9092']);
  });

  it('lee variables de entorno y separa los brokers', () => {
    const cfg = loadConfig({ PORT: '4000', KAFKA_BROKERS: 'a:9092, b:9092' });

    expect(cfg.port).toBe(4000);
    expect(cfg.kafka.brokers).toEqual(['a:9092', 'b:9092']);
  });

  it('ignora un puerto inválido', () => {
    expect(loadConfig({ PORT: 'abc' }).port).toBe(3002);
  });
});
