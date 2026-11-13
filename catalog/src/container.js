const { getPool } = require('./infrastructure/database/pool');
const PgServiceRepository = require('./infrastructure/repositories/PgServiceRepository');
const PgOutboxRepository = require('./infrastructure/outbox/PgOutboxRepository');
const PgUnitOfWork = require('./infrastructure/database/PgUnitOfWork');
const CreateService = require('./application/commands/CreateService');
const UpdateService = require('./application/commands/UpdateService');
const ChangeServicePrice = require('./application/commands/ChangeServicePrice');
const ActivateService = require('./application/commands/ActivateService');
const DeactivateService = require('./application/commands/DeactivateService');
const GetActiveServices = require('./application/queries/GetActiveServices');
const GetAllServices = require('./application/queries/GetAllServices');
const GetServiceById = require('./application/queries/GetServiceById');
const GetServicesByIds = require('./application/queries/GetServicesByIds');

/**
 * Composition root: único lugar donde se cablean las dependencias concretas (DIP).
 * Construye de forma perezosa o con las dependencias recibidas el pool de PostgreSQL,
 * los repositorios, el UnitOfWork transaccional (Outbox) y los Commands/Queries de Application.
 */
function buildContainer({ config, pool, repository, outboxRepository, unitOfWork, eventPublisher } = {}) {
  const resolvedConfig = config || require('./config/env').config;

  let resolvedPool = pool || null;
  const resolvePool = () => {
    if (!resolvedPool) {
      resolvedPool = getPool({ connectionString: resolvedConfig.databaseUrl });
    }
    return resolvedPool;
  };

  let resolvedRepository = repository || null;
  const resolveRepository = () => {
    if (!resolvedRepository) {
      resolvedRepository = new PgServiceRepository({ pool: resolvePool() });
    }
    return resolvedRepository;
  };

  let resolvedOutboxRepository = outboxRepository || null;
  const resolveOutboxRepository = () => {
    if (!resolvedOutboxRepository) {
      resolvedOutboxRepository = new PgOutboxRepository({ pool: resolvePool() });
    }
    return resolvedOutboxRepository;
  };

  let resolvedUnitOfWork = unitOfWork || null;
  const resolveUnitOfWork = () => {
    if (!resolvedUnitOfWork) {
      if (repository && !pool) {
        return null;
      }
      resolvedUnitOfWork = new PgUnitOfWork({ pool: resolvePool() });
    }
    return resolvedUnitOfWork;
  };

  const buildCommandDeps = () => ({
    repository: resolveRepository(),
    unitOfWork: resolveUnitOfWork(),
    eventPublisher: eventPublisher || null
  });

  return Object.freeze({
    config: resolvedConfig,
    get pool() {
      return resolvePool();
    },
    get serviceRepository() {
      return resolveRepository();
    },
    get outboxRepository() {
      return resolveOutboxRepository();
    },
    get unitOfWork() {
      return resolveUnitOfWork();
    },
    get commands() {
      const deps = buildCommandDeps();
      return Object.freeze({
        createService: new CreateService(deps),
        updateService: new UpdateService(deps),
        changeServicePrice: new ChangeServicePrice(deps),
        activateService: new ActivateService(deps),
        deactivateService: new DeactivateService(deps)
      });
    },
    get queries() {
      const repo = resolveRepository();
      return Object.freeze({
        getActiveServices: new GetActiveServices({ repository: repo }),
        getAllServices: new GetAllServices({ repository: repo }),
        getServiceById: new GetServiceById({ repository: repo }),
        getServicesByIds: new GetServicesByIds({ repository: repo })
      });
    }
  });
}

module.exports = { buildContainer };
