/**
 * Composition root: único lugar donde se cablean las dependencias concretas (DIP).
 * En esta etapa solo expone la configuración; los repositorios, handlers y
 * publicadores se registrarán en pasos posteriores.
 */
function buildContainer({ config } = {}) {
  const resolvedConfig = config || require('./config/env').config;

  return Object.freeze({
    config: resolvedConfig
  });
}

module.exports = { buildContainer };
