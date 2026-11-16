const InMemoryUserRepository = require('./infrastructure/persistence/InMemoryUserRepository');
const BcryptPasswordHasher = require('./infrastructure/security/BcryptPasswordHasher');
const JwtTokenService = require('./infrastructure/security/JwtTokenService');
const { ConsoleEventPublisher } = require('./infrastructure/messaging/ConsoleEventPublisher');
const RegisterUser = require('./application/commands/RegisterUser');
const AuthenticateUser = require('./application/commands/AuthenticateUser');
const ChangeUserRole = require('./application/commands/ChangeUserRole');
const UpdateUserProfile = require('./application/commands/UpdateUserProfile');
const ActivateUser = require('./application/commands/ActivateUser');
const DeactivateUser = require('./application/commands/DeactivateUser');
const ChangeOwnPassword = require('./application/commands/ChangeOwnPassword');
const ResetUserPassword = require('./application/commands/ResetUserPassword');
const BootstrapAdmin = require('./application/commands/BootstrapAdmin');
const GetUserById = require('./application/queries/GetUserById');
const ListUsers = require('./application/queries/ListUsers');
const VerifyAccessToken = require('./application/queries/VerifyAccessToken');
const ListRoles = require('./application/queries/ListRoles');

/**
 * Composition root: único lugar donde se eligen las implementaciones concretas de los puertos.
 * Cualquier dependencia se puede inyectar (pruebas, o el futuro repositorio PostgreSQL / publicador Kafka).
 */
function buildContainer({
  config,
  repository = new InMemoryUserRepository(),
  passwordHasher = new BcryptPasswordHasher({ rounds: config.bcryptRounds }),
  tokenService = new JwtTokenService(config.jwt),
  eventPublisher = new ConsoleEventPublisher(),
  clock,
  idGenerator
}) {
  const shared = { repository, eventPublisher };
  if (clock) shared.clock = clock;

  const registerUser = new RegisterUser({
    ...shared,
    passwordHasher,
    ...(idGenerator ? { idGenerator } : {})
  });

  const commands = Object.freeze({
    registerUser,
    authenticateUser: new AuthenticateUser({ repository, passwordHasher, tokenService, ...(clock ? { clock } : {}) }),
    changeUserRole: new ChangeUserRole(shared),
    updateUserProfile: new UpdateUserProfile(shared),
    activateUser: new ActivateUser(shared),
    deactivateUser: new DeactivateUser(shared),
    changeOwnPassword: new ChangeOwnPassword({ ...shared, passwordHasher }),
    resetUserPassword: new ResetUserPassword({ ...shared, passwordHasher }),
    bootstrapAdmin: new BootstrapAdmin({ repository, registerUser })
  });

  const queries = Object.freeze({
    getUserById: new GetUserById({ repository }),
    listUsers: new ListUsers({ repository }),
    verifyAccessToken: new VerifyAccessToken({ repository, tokenService }),
    listRoles: new ListRoles()
  });

  return Object.freeze({ config, repository, passwordHasher, tokenService, eventPublisher, commands, queries });
}

module.exports = { buildContainer };
