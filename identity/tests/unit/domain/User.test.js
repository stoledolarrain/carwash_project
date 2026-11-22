const User = require('../../../src/domain/entities/User');
const Email = require('../../../src/domain/value-objects/Email');
const FullName = require('../../../src/domain/value-objects/FullName');
const PlainPassword = require('../../../src/domain/value-objects/PlainPassword');
const { Role } = require('../../../src/domain/value-objects/Role');
const {
  InvalidEmailError,
  InvalidFullNameError,
  InvalidRoleError,
  WeakPasswordError
} = require('../../../src/domain/errors/DomainErrors');

const NOW = new Date('2026-11-16T10:00:00.000Z');

function newUser(overrides = {}) {
  return User.register({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'Recepcion@CarWash.local',
    fullName: '  Maria   Lopez ',
    passwordHash: '$2a$04$hash',
    role: 'receptionist',
    now: NOW,
    ...overrides
  });
}

describe('Value Objects de Identity', () => {
  it('Email normaliza a minúsculas y rechaza formatos inválidos', () => {
    expect(new Email('  Ana@Mail.COM ').value).toBe('ana@mail.com');
    expect(() => new Email('no-es-correo')).toThrow(InvalidEmailError);
    expect(() => new Email(42)).toThrow(InvalidEmailError);
  });

  it('FullName colapsa espacios y exige longitud mínima', () => {
    expect(new FullName('  Juan   Perez ').value).toBe('Juan Perez');
    expect(() => new FullName('Jo')).toThrow(InvalidFullNameError);
  });

  it('Role acepta minúsculas y rechaza roles inexistentes', () => {
    expect(new Role('washer').value).toBe('WASHER');
    expect(new Role('ADMIN').isAdmin()).toBe(true);
    expect(() => new Role('SUPERUSER')).toThrow(InvalidRoleError);
  });

  it('PlainPassword exige 8+ caracteres con letras y números y nunca se serializa', () => {
    expect(() => new PlainPassword('corta1')).toThrow(WeakPasswordError);
    expect(() => new PlainPassword('sololetras')).toThrow(WeakPasswordError);
    expect(() => new PlainPassword('12345678')).toThrow(WeakPasswordError);
    expect(() => new PlainPassword('a'.repeat(72) + '1')).toThrow(WeakPasswordError);
    const password = new PlainPassword('Segura123');
    expect(JSON.stringify({ password })).toBe('{"password":"[PROTECTED]"}');
  });
});

describe('Agregado User', () => {
  it('register normaliza datos y emite UserRegistered sin datos sensibles', () => {
    const user = newUser();
    expect(user.email).toBe('recepcion@carwash.local');
    expect(user.fullName).toBe('Maria Lopez');
    expect(user.role).toBe('RECEPTIONIST');
    expect(user.isActive).toBe(true);
    expect(user.version).toBe(1);

    const events = user.pullDomainEvents();
    expect(events.map((e) => e.name)).toEqual(['UserRegistered']);
    expect(events[0].payload).not.toHaveProperty('passwordHash');
    expect(user.pullDomainEvents()).toEqual([]);
  });

  it('changeRole emite evento, sube versión e invalida tokens; mismo rol es idempotente', () => {
    const user = newUser();
    user.pullDomainEvents();

    user.changeRole('RECEPTIONIST');
    expect(user.pullDomainEvents()).toEqual([]);
    expect(user.version).toBe(1);

    user.changeRole('WASHER');
    const [event] = user.pullDomainEvents();
    expect(event.name).toBe('UserRoleChanged');
    expect(event.payload).toMatchObject({ previousRole: 'RECEPTIONIST', newRole: 'WASHER' });
    expect(user.version).toBe(2);
    expect(user.tokenVersion).toBe(1);
  });

  it('deactivate/activate son idempotentes y deactivate revoca tokens', () => {
    const user = newUser();
    user.pullDomainEvents();

    user.deactivate();
    user.deactivate();
    expect(user.isActive).toBe(false);
    expect(user.tokenVersion).toBe(1);
    expect(user.pullDomainEvents().map((e) => e.name)).toEqual(['UserDeactivated']);

    user.activate();
    user.activate();
    expect(user.isActive).toBe(true);
    expect(user.pullDomainEvents().map((e) => e.name)).toEqual(['UserActivated']);
  });

  it('changePasswordHash revoca tokens; recordLogin no emite eventos ni sube versión', () => {
    const user = newUser();
    user.pullDomainEvents();

    user.recordLogin(NOW);
    expect(user.lastLoginAt).toEqual(NOW);
    expect(user.version).toBe(1);
    expect(user.pullDomainEvents()).toEqual([]);

    user.changePasswordHash('$2a$04$otro');
    expect(user.tokenVersion).toBe(1);
    expect(user.pullDomainEvents().map((e) => e.name)).toEqual(['UserPasswordChanged']);
  });

  it('restore reconstruye el agregado desde un snapshot sin emitir eventos', () => {
    const snapshot = newUser().toSnapshot();
    const restored = User.restore(snapshot);
    expect(restored.toSnapshot()).toEqual(snapshot);
    expect(restored.pullDomainEvents()).toEqual([]);
  });
});
