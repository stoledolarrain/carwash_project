const { loadConfig, DEFAULT_PORT } = require('../../src/config/env');

const SECRET = 's'.repeat(40);

describe('Configuración (env)', () => {
  it('falla al arrancar si JWT_SECRET falta o es corto', () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('aplica valores por defecto seguros', () => {
    const config = loadConfig({ JWT_SECRET: SECRET });
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.trustProxy).toBe(false);
    expect(config.jwt).toMatchObject({ expiresIn: '1h', issuer: 'carwash-identity', audience: 'carwash-platform' });
    expect(config.bcryptRounds).toBe(10);
    expect(config.bootstrapAdmin.email).toBeNull();
  });

  it('lee TRUST_PROXY y limita el costo de bcrypt', () => {
    const config = loadConfig({ JWT_SECRET: SECRET, TRUST_PROXY: '1', BCRYPT_ROUNDS: '99' });
    expect(config.trustProxy).toBe(1);
    expect(config.bcryptRounds).toBe(15);
  });
});
