'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'src');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function requiredModules(file) {
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
}

describe('Reglas de dependencias entre capas', () => {
  const external = ['express', 'pg', 'kafkajs', 'dotenv'];

  it('Domain no depende de Application, Infrastructure, Presentation ni librerías externas', () => {
    for (const file of jsFiles(path.join(SRC, 'domain'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/application|infrastructure|presentation/);
        expect(external).not.toContain(mod);
      }
    }
  });

  it('Application no depende de Infrastructure, Presentation, Express, pg ni KafkaJS', () => {
    for (const file of jsFiles(path.join(SRC, 'application'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/infrastructure|presentation/);
        expect(external).not.toContain(mod);
      }
    }
  });

  it('Presentation no depende directamente de Infrastructure, pg ni KafkaJS', () => {
    for (const file of jsFiles(path.join(SRC, 'presentation'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/infrastructure/);
        expect(['pg', 'kafkajs']).not.toContain(mod);
      }
    }
  });
});
