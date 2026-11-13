const request = require('supertest');
const { createApp } = require('../../src/app');

describe('GET /health', () => {
  const app = createApp();

  it('responde 200 con el estado del servicio', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('catalog-service');
  });

  it('responde 404 con formato de error uniforme en rutas inexistentes', async () => {
    const res = await request(app).get('/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 400 ante un JSON inválido', async () => {
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{malformado');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
