const crypto = require('node:crypto');
const User = require('../../domain/entities/User');
const Email = require('../../domain/value-objects/Email');
const PlainPassword = require('../../domain/value-objects/PlainPassword');
const { EmailAlreadyRegisteredError } = require('../errors/ApplicationErrors');
const { persistAndPublish } = require('../support/persistAndPublish');

/**
 * Command: un administrador registra un usuario del personal (recepcionista, lavador u otro administrador).
 * No existe registro público: así ninguna cuenta obtiene permisos sin que un administrador lo decida.
 */
class RegisterUser {
  constructor({ repository, passwordHasher, eventPublisher, idGenerator = crypto.randomUUID, clock = () => new Date() }) {
    this.repository = repository;
    this.passwordHasher = passwordHasher;
    this.eventPublisher = eventPublisher;
    this.idGenerator = idGenerator;
    this.clock = clock;
  }

  /** @param {{ email: string, fullName: string, password: string, role: string }} input */
  async execute({ email, fullName, password, role }) {
    const normalizedEmail = new Email(email);
    const plainPassword = new PlainPassword(password);

    const existing = await this.repository.findByEmail(normalizedEmail.value);
    if (existing) {
      throw new EmailAlreadyRegisteredError(normalizedEmail.value);
    }

    const passwordHash = await this.passwordHasher.hash(plainPassword.value);
    const user = User.register({
      id: this.idGenerator(),
      email: normalizedEmail,
      fullName,
      passwordHash,
      role,
      now: this.clock()
    });

    return persistAndPublish(user, { repository: this.repository, eventPublisher: this.eventPublisher });
  }
}

module.exports = RegisterUser;
