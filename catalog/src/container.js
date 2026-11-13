const { getPool } = require('./infrastructure/database/pool');
const PgServiceRepository = require('./infrastructure/repositories/PgServiceRepository');
const PgOutboxRepository = require('./infrastructure/outbox/PgOutboxRepository');
const PgUnitOfWork = require('./infrastructure/database/PgUnitOfWork');
const { getKafkaEventPublisher } = require('./infrastructure/messaging/KafkaEventPublisher');
const OutboxWorker = require('./infrastructure/messaging/OutboxWorker');
const CreateService = require('./application/commands/CreateService');
const UpdateService = require('./application/commands/UpdateService');
const ChangeServicePrice = require('./application/commands/ChangeServicePrice');
const ActivateService = require('./application/commands/ActivateService');
const DeactivateService = require('./application/commands/DeactivateService');
const GetActiveServices = require('./application/queries/GetActiveServices');
const GetAllServices = require('./application/queries/GetAllServices');
const GetServiceById = require('./application/queries/GetServiceById');
const GetServicesByIds = require('./application/queries/GetServicesByIds');
const CatalogController = require('./presentation/controllers/CatalogController');

/**
 * Composition root: único lugar donde se cablean las dependencias concretas (DIP).
 * Construye de forma perezosa o con las dependencias recibidas el pool de PostgreSQL,
 * los repositorios, el UnitOfWork transaccional (Outbox), el KafkaEventPublisher (Singleton),
 * el OutboxWorker, los Commands/Queries de Application y el controlador HTTP de Presentation.
 */
function buildContainer({
  config,
  pool,
  repository,
  outboxRepository,
  unitOfWork,
  eventPublisher,
  kafkaPublisher,
  outboxWorker,
  commands,
  queries
} = {}) {
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

  let resolvedKafkaPublisher = kafkaPublisher || null;
  const resolveKafkaPublisher = () => {
    if (!resolvedKafkaPublisher) {
      resolvedKafkaPublisher = getKafkaEventPublisher({
        brokers: resolvedConfig.kafka.brokers,
        clientId: resolvedConfig.kafka.clientId
      });
    }
    return resolvedKafkaPublisher;
  };

  let resolvedOutboxWorker = outboxWorker || null;
  const resolveOutboxWorker = () => {
    if (!resolvedOutboxWorker) {
      resolvedOutboxWorker = new OutboxWorker({
        outboxRepository: resolveOutboxRepository(),
        kafkaPublisher: resolveKafkaPublisher(),
        pollIntervalMs: resolvedConfig.outbox.pollIntervalMs,
        batchSize: resolvedConfig.outbox.batchSize
      });
    }
    return resolvedOutboxWorker;
  };

  const buildCommandDeps = () => ({
    repository: resolveRepository(),
    unitOfWork: resolveUnitOfWork(),
    eventPublisher: eventPublisher || null
  });

  let resolvedCommands = commands || null;
  const resolveCommands = () => {
    if (!resolvedCommands) {
      const deps = buildCommandDeps();
      resolvedCommands = Object.freeze({
        createService: new CreateService(deps),
        updateService: new UpdateService(deps),
        changeServicePrice: new ChangeServicePrice(deps),
        activateService: new ActivateService(deps),
        deactivateService: new DeactivateService(deps)
      });
    }
    return resolvedCommands;
  };

  let resolvedQueries = queries || null;
  const resolveQueries = () => {
    if (!resolvedQueries) {
      const repo = resolveRepository();
      resolvedQueries = Object.freeze({
        getActiveServices: new GetActiveServices({ repository: repo }),
        getAllServices: new GetAllServices({ repository: repo }),
        getServiceById: new GetServiceById({ repository: repo }),
        getServicesByIds: new GetServicesByIds({ repository: repo })
      });
    }
    return resolvedQueries;
  };

  let resolvedController = null;
  const resolveController = () => {
    if (!resolvedController) {
      resolvedController = new CatalogController({
        commands: resolveCommands(),
        queries: resolveQueries()
      });
    }
    return resolvedController;
  };

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
    get kafkaPublisher() {
      return resolveKafkaPublisher();
    },
    get outboxWorker() {
      return resolveOutboxWorker();
    },
    get commands() {
      return resolveCommands();
    },
    get queries() {
      return resolveQueries();
    },
    get catalogController() {
      return resolveController();
    }
  });
}

module.exports = { buildContainer };
