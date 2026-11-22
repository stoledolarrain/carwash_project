const Email = require('../../domain/value-objects/Email');
const { InvalidCredentialsError, AccountDisabledError } = require('../errors/ApplicationErrors');
const { toUserDto } = require('../dtos/UserDto');

/**
 * Command: inicio de sesión. Verifica credenciales, registra el último acceso y emite un JWT.
 *
 * Seguridad:
 * - Responde el mismo error si el correo no existe o si la contraseña es incorrecta.
 * - Si el correo no existe, igual compara contra un hash ficticio para que el tiempo de respuesta
 *   no revele qué correos están registrados.
 * - Solo informa que la cuenta está desactivada después de validar la contraseña.
 */
class AuthenticateUser {
  #dummyHashPromise = null;

  constructor({ repository, passwordHasher, tokenService, clock = () => new Date() }) {
    this.repository = repository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.clock = clock;
  }

  /** @param {{ email: string, password: string }} input */
  async execute({ email, password }) {
    let normalizedEmail = null;
    try {
      normalizedEmail = new Email(email).value;
    } catch {
      normalizedEmail = null;
    }

    const user = normalizedEmail ? await this.repository.findByEmail(normalizedEmail) : null;
    const hashToCompare = user ? user.passwordHash : await this.#dummyHash();
    const passwordMatches = await this.passwordHasher.compare(String(password ?? ''), hashToCompare);

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }
    if (!user.isActive) {
      throw new AccountDisabledError();
    }

    user.recordLogin(this.clock());
    await this.repository.save(user, { expectedVersion: user.version });

    const token = this.tokenService.issue({ sub: user.id, role: user.role, tv: user.tokenVersion });
    return { ...token, user: toUserDto(user) };
  }

  #dummyHash() {
    if (!this.#dummyHashPromise) {
      this.#dummyHashPromise = this.passwordHasher.hash('usuario-inexistente-0000');
    }
    return this.#dummyHashPromise;
  }
}

module.exports = AuthenticateUser;
