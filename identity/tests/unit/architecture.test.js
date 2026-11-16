const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'src');
const EXTERNAL = ['express', 'jsonwebtoken', 'bcryptjs', 'dotenv', 'pg', 'kafkajs'];

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

describe('Reglas de dependencias entre capas (Clean Architecture)', () => {
  it('Domain no depende de otras capas ni de librerías externas', () => {
    for (const file of jsFiles(path.join(SRC, 'domain'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/application|infrastructure|presentation/);
        expect(EXTERNAL).not.toContain(mod);
      }
    }
  });

  it('Application no depende de Infrastructure, Presentation ni librerías externas', () => {
    for (const file of jsFiles(path.join(SRC, 'application'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/infrastructure|presentation/);
        expect(EXTERNAL).not.toContain(mod);
      }
    }
  });

  it('Presentation no depende de Infrastructure ni de librerías de seguridad o persistencia', () => {
    for (const file of jsFiles(path.join(SRC, 'presentation'))) {
      for (const mod of requiredModules(file)) {
        expect(mod).not.toMatch(/infrastructure/);
        expect(['jsonwebtoken', 'bcryptjs', 'pg', 'kafkajs']).not.toContain(mod);
      }
    }
  });
});
