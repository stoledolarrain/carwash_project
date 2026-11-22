const Email = require('../value-objects/Email');
const FullName = require('../value-objects/FullName');
const { Role } = require('../value-objects/Role');
const {
  UserRegistered,
  UserRoleChanged,
  UserProfileUpdated,
  UserPasswordChanged,
  UserActivated,
  UserDeactivated
} = require('../events/UserEvents');

/**
 * Raíz de agregado de Identity.
 *
 * - `passwordHash`: solo se guarda el hash; el dominio nunca ve ni conserva la contraseña en claro.
 * - `tokenVersion`: se incrementa al cambiar contraseña, rol o al desactivar la cuenta.
 *   Los JWT llevan esta versión, así que los tokens emitidos antes del cambio dejan de ser válidos (revocación).
 * - `version`: contador de concurrencia optimista que usará el repositorio PostgreSQL.
 */
class User {
  #id;
  #email;
  #fullName;
  #passwordHash;
  #role;
  #isActive;
  #tokenVersion;
  #version;
  #createdAt;
  #updatedAt;
  #lastLoginAt;
  #pendingEvents = [];

  constructor({
    id,
    email,
    fullName,
    passwordHash,
    role,
    isActive = true,
    tokenVersion = 0,
    version = 1,
    createdAt,
    updatedAt,
    lastLoginAt = null
  }) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('User requiere un id.');
    }
    if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
      throw new Error('User requiere un passwordHash.');
    }
    this.#id = id;
    this.#email = email instanceof Email ? email : new Email(email);
    this.#fullName = fullName instanceof FullName ? fullName : new FullName(fullName);
    this.#passwordHash = passwordHash;
    this.#role = role instanceof Role ? role : new Role(role);
    this.#isActive = Boolean(isActive);
    this.#tokenVersion = tokenVersion;
    this.#version = version;
    this.#createdAt = new Date(createdAt);
    this.#updatedAt = new Date(updatedAt || createdAt);
    this.#lastLoginAt = lastLoginAt ? new Date(lastLoginAt) : null;
  }

  /** Crea un usuario nuevo y registra el evento `UserRegistered`. */
  static register({ id, email, fullName, passwordHash, role, now = new Date() }) {
    const user = new User({ id, email, fullName, passwordHash, role, createdAt: now, updatedAt: now });
    user.#record(
      new UserRegistered(user.id, now, {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      })
    );
    return user;
  }

  /** Reconstruye el agregado desde persistencia sin emitir eventos. */
  static restore(snapshot) {
    return new User(snapshot);
  }

  get id() {
    return this.#id;
  }
  get email() {
    return this.#email.value;
  }
  get fullName() {
    return this.#fullName.value;
  }
  get passwordHash() {
    return this.#passwordHash;
  }
  get role() {
    return this.#role.value;
  }
  get permissions() {
    return this.#role.permissions;
  }
  get isActive() {
    return this.#isActive;
  }
  get tokenVersion() {
    return this.#tokenVersion;
  }
  get version() {
    return this.#version;
  }
  get createdAt() {
    return new Date(this.#createdAt);
  }
  get updatedAt() {
    return new Date(this.#updatedAt);
  }
  get lastLoginAt() {
    return this.#lastLoginAt ? new Date(this.#lastLoginAt) : null;
  }

  isAdmin() {
    return this.#role.isAdmin();
  }

  /** Cambia el rol. Si es el mismo, no hace nada (idempotente, sin evento). */
  changeRole(newRole, now = new Date()) {
    const role = newRole instanceof Role ? newRole : new Role(newRole);
    if (role.equals(this.#role)) {
      return;
    }
    const previousRole = this.#role.value;
    this.#role = role;
    this.#tokenVersion += 1;
    this.#touch(now);
    this.#record(new UserRoleChanged(this.#id, now, { id: this.#id, previousRole, newRole: role.value }));
  }

  /** Actualiza el nombre visible. Si no cambia, no emite evento. */
  updateProfile({ fullName }, now = new Date()) {
    const name = fullName instanceof FullName ? fullName : new FullName(fullName);
    if (name.equals(this.#fullName)) {
      return;
    }
    this.#fullName = name;
    this.#touch(now);
    this.#record(new UserProfileUpdated(this.#id, now, { id: this.#id, fullName: name.value }));
  }

  /** Reemplaza el hash de la contraseña e invalida los tokens emitidos antes. */
  changePasswordHash(newPasswordHash, now = new Date()) {
    if (typeof newPasswordHash !== 'string' || newPasswordHash.length === 0) {
      throw new Error('changePasswordHash requiere un hash.');
    }
    this.#passwordHash = newPasswordHash;
    this.#tokenVersion += 1;
    this.#touch(now);
    this.#record(new UserPasswordChanged(this.#id, now, { id: this.#id }));
  }

  activate(now = new Date()) {
    if (this.#isActive) {
      return;
    }
    this.#isActive = true;
    this.#touch(now);
    this.#record(new UserActivated(this.#id, now, { id: this.#id, email: this.email, role: this.role }));
  }

  /** Desactiva la cuenta e invalida sus tokens vigentes. */
  deactivate(now = new Date()) {
    if (!this.#isActive) {
      return;
    }
    this.#isActive = false;
    this.#tokenVersion += 1;
    this.#touch(now);
    this.#record(new UserDeactivated(this.#id, now, { id: this.#id, email: this.email, role: this.role }));
  }

  /** Marca el último inicio de sesión. No es un hecho de negocio relevante para otros servicios: no emite evento. */
  recordLogin(now = new Date()) {
    this.#lastLoginAt = new Date(now);
  }

  pullDomainEvents() {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }

  toSnapshot() {
    return {
      id: this.#id,
      email: this.email,
      fullName: this.fullName,
      passwordHash: this.#passwordHash,
      role: this.role,
      isActive: this.#isActive,
      tokenVersion: this.#tokenVersion,
      version: this.#version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt
    };
  }

  #touch(now) {
    this.#version += 1;
    this.#updatedAt = new Date(now);
  }

  #record(event) {
    this.#pendingEvents.push(event);
  }
}

module.exports = User;
