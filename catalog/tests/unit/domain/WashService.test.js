'use strict'; // En modo estricto, asignar a una propiedad solo-lectura lanza TypeError

const WashService = require('../../../src/domain/entities/WashService');
const {
  InvalidServiceNameError,
  InvalidDescriptionError,
  InvalidPriceError,
  InvalidDurationError,
  InvalidCurrencyError,
  InvalidServiceError,
  ServiceAlreadyActiveError,
  ServiceAlreadyInactiveError
} = require('../../../src/domain/errors/DomainErrors');

const T0 = new Date('2026-01-01T10:00:00.000Z');
const T1 = new Date('2026-01-02T10:00:00.000Z');
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validProps(overrides = {}) {
  return { name: 'Lavado completo', description: 'Exterior e interior', price: 80, estimatedDuration: 45, now: T0, ...overrides };
}

describe('WashService.create', () => {
  it('crea un servicio válido, activo, con version 1, UUID, BOB y fechas', () => {
    const service = WashService.create(validProps());

    expect(service.id).toMatch(UUID_V4);
    expect(service.name).toBe('Lavado completo');
    expect(service.description).toBe('Exterior e interior');
    expect(service.price).toBe(80);
    expect(service.priceCents).toBe(8000);
    expect(service.currency).toBe('BOB');
    expect(service.estimatedDuration).toBe(45);
    expect(service.isActive).toBe(true);
    expect(service.version).toBe(1);
    expect(service.createdAt).toEqual(T0);
    expect(service.updatedAt).toEqual(T0);
  });

  it('usa descripción vacía si no se envía y normaliza espacios', () => {
    expect(WashService.create(validProps({ description: undefined })).description).toBe('');
    expect(WashService.create(validProps({ name: '  Pulido ' })).name).toBe('Pulido');
  });

  it('acepta descripción de hasta 500 caracteres y rechaza 501 o tipos inválidos', () => {
    expect(WashService.create(validProps({ description: 'd'.repeat(500) })).description).toHaveLength(500);
    expect(() => WashService.create(validProps({ description: 'd'.repeat(501) }))).toThrow(InvalidDescriptionError);
    expect(() => WashService.create(validProps({ description: 123 }))).toThrow(InvalidDescriptionError);
  });

  it('respeta un id UUID proporcionado y rechaza uno inválido', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(WashService.create(validProps({ id })).id).toBe(id);
    expect(() => WashService.create(validProps({ id: 'abc' }))).toThrow(InvalidServiceError);
  });

  it.each([['vacío', ''], ['solo espacios', '   '], ['ausente', undefined], ['demasiado largo', 'a'.repeat(101)]])(
    'rechaza nombre %s',
    (_, name) => {
      expect(() => WashService.create(validProps({ name }))).toThrow(InvalidServiceNameError);
    }
  );

  it('rechaza precios negativos o inválidos', () => {
    expect(() => WashService.create(validProps({ price: -1 }))).toThrow(InvalidPriceError);
    expect(() => WashService.create(validProps({ price: undefined }))).toThrow(InvalidPriceError);
  });

  it('permite precio cero', () => {
    expect(WashService.create(validProps({ price: 0 })).price).toBe(0);
  });

  it.each([0, -10, 1.5, undefined])('rechaza duración %s', (estimatedDuration) => {
    expect(() => WashService.create(validProps({ estimatedDuration }))).toThrow(InvalidDurationError);
  });

  it('rechaza monedas distintas de BOB', () => {
    expect(() => WashService.create(validProps({ currency: 'USD' }))).toThrow(InvalidCurrencyError);
  });

  it('registra el evento ServiceCreated', () => {
    const service = WashService.create(validProps());
    const events = service.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('ServiceCreated');
    expect(events[0].aggregateId).toBe(service.id);
    expect(events[0].occurredAt).toEqual(T0);
    expect(events[0].payload).toMatchObject({
      id: service.id, name: 'Lavado completo', price: 80, currency: 'BOB', estimatedDuration: 45, isActive: true, version: 1
    });
  });
});

describe('WashService encapsulación', () => {
  it('no permite modificar propiedades directamente', () => {
    const service = WashService.create(validProps());

    expect(() => { service.name = 'Otro'; }).toThrow(TypeError);
    expect(() => { service.price = 1; }).toThrow(TypeError);
    expect(() => { service.isActive = false; }).toThrow(TypeError);
    expect(() => { service.version = 99; }).toThrow(TypeError);
    expect(service.name).toBe('Lavado completo');
  });

  it('las fechas devueltas son copias', () => {
    const service = WashService.create(validProps());
    service.createdAt.setFullYear(1999);
    expect(service.createdAt).toEqual(T0);
  });
});

describe('WashService.update', () => {
  it('actualiza datos generales, incrementa version y updatedAt, sin tocar precio ni estado', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.update({ name: 'Lavado premium', description: 'Con cera', estimatedDuration: 60 }, T1);

    expect(service.name).toBe('Lavado premium');
    expect(service.description).toBe('Con cera');
    expect(service.estimatedDuration).toBe(60);
    expect(service.price).toBe(80);
    expect(service.isActive).toBe(true);
    expect(service.version).toBe(2);
    expect(service.createdAt).toEqual(T0);
    expect(service.updatedAt).toEqual(T1);
  });

  it('actualiza solo los campos enviados y registra ServiceUpdated con changedFields', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.update({ estimatedDuration: 50 }, T1);
    const [event] = service.pullDomainEvents();

    expect(service.name).toBe('Lavado completo');
    expect(event.name).toBe('ServiceUpdated');
    expect(event.aggregateId).toBe(service.id);
    expect(event.payload.changedFields).toEqual(['estimatedDuration']);
    expect(event.payload.estimatedDuration).toBe(50);
    expect(event.payload.version).toBe(2);
  });

  it('rechaza datos inválidos sin modificar el estado ni la versión', () => {
    const service = WashService.create(validProps());

    expect(() => service.update({ name: '' })).toThrow(InvalidServiceNameError);
    expect(() => service.update({ name: 'Nuevo', estimatedDuration: 0 })).toThrow(InvalidDurationError);
    expect(() => service.update({ description: 'x'.repeat(501) })).toThrow(InvalidDescriptionError);
    expect(service.name).toBe('Lavado completo');
    expect(service.estimatedDuration).toBe(45);
    expect(service.version).toBe(1);
  });

  it('no registra evento ni cambia updatedAt ni version si no hay cambios reales', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.update({ name: 'Lavado completo', estimatedDuration: 45 }, T1);

    expect(service.pullDomainEvents()).toHaveLength(0);
    expect(service.updatedAt).toEqual(T0);
    expect(service.version).toBe(1);
  });
});

describe('WashService.changePrice', () => {
  it('cambia el precio, incrementa version, actualiza updatedAt y registra ServicePriceChanged', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.changePrice(95.5, 'BOB', T1);
    const [event] = service.pullDomainEvents();

    expect(service.price).toBe(95.5);
    expect(service.priceCents).toBe(9550);
    expect(service.version).toBe(2);
    expect(service.updatedAt).toEqual(T1);
    expect(event.name).toBe('ServicePriceChanged');
    expect(event.aggregateId).toBe(service.id);
    expect(event.payload).toEqual({
      id: service.id,
      name: 'Lavado completo',
      previousPrice: 80,
      newPrice: 95.5,
      currency: 'BOB',
      version: 2
    });
  });

  it('rechaza precio negativo sin modificar el servicio', () => {
    const service = WashService.create(validProps());

    expect(() => service.changePrice(-5)).toThrow(InvalidPriceError);
    expect(service.price).toBe(80);
    expect(service.version).toBe(1);
  });

  it('rechaza una moneda distinta de BOB', () => {
    const service = WashService.create(validProps());
    expect(() => service.changePrice(10, 'USD')).toThrow(InvalidCurrencyError);
  });

  it('no registra evento si el precio no cambia', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.changePrice(80, 'BOB', T1);

    expect(service.pullDomainEvents()).toHaveLength(0);
    expect(service.updatedAt).toEqual(T0);
    expect(service.version).toBe(1);
  });
});

describe('WashService activate / deactivate', () => {
  it('desactiva un servicio activo, incrementa version y registra ServiceDeactivated', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    service.deactivate(T1);
    const [event] = service.pullDomainEvents();

    expect(service.isActive).toBe(false);
    expect(service.version).toBe(2);
    expect(service.updatedAt).toEqual(T1);
    expect(event.name).toBe('ServiceDeactivated');
    expect(event.aggregateId).toBe(service.id);
    expect(event.payload).toEqual({
      id: service.id,
      name: 'Lavado completo',
      isActive: false,
      version: 2
    });
  });

  it('activa un servicio inactivo, incrementa version y registra ServiceActivated', () => {
    const service = WashService.create(validProps());
    service.deactivate(T0);
    service.pullDomainEvents();

    service.activate(T1);
    const [event] = service.pullDomainEvents();

    expect(service.isActive).toBe(true);
    expect(service.version).toBe(3);
    expect(event.name).toBe('ServiceActivated');
    expect(event.payload.isActive).toBe(true);
    expect(event.payload.version).toBe(3);
  });

  it('lanza ServiceAlreadyActiveError al activar un servicio activo, sin registrar eventos', () => {
    const service = WashService.create(validProps());
    service.pullDomainEvents();

    expect(() => service.activate()).toThrow(ServiceAlreadyActiveError);
    expect(service.pullDomainEvents()).toHaveLength(0);
    expect(service.updatedAt).toEqual(T0);
    expect(service.version).toBe(1);
  });

  it('lanza ServiceAlreadyInactiveError al desactivar un servicio inactivo, sin registrar eventos', () => {
    const service = WashService.create(validProps());
    service.deactivate(T0);
    service.pullDomainEvents();

    expect(() => service.deactivate()).toThrow(ServiceAlreadyInactiveError);
    expect(service.pullDomainEvents()).toHaveLength(0);
    expect(service.version).toBe(2);
  });
});

describe('Eventos de dominio', () => {
  it('pullDomainEvents devuelve los eventos en orden y los vacía', () => {
    const service = WashService.create(validProps());
    service.changePrice(90, 'BOB', T1);
    service.deactivate(T1);

    const events = service.pullDomainEvents();

    expect(events.map((e) => e.name)).toEqual(['ServiceCreated', 'ServicePriceChanged', 'ServiceDeactivated']);
    expect(service.pullDomainEvents()).toEqual([]);
  });

  it('los eventos son inmutables', () => {
    const [event] = WashService.create(validProps()).pullDomainEvents();

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
  });
});

describe('WashService.restore', () => {
  const row = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Encerado',
    description: null,
    priceCents: 3500,
    currency: 'BOB',
    estimatedDuration: 20,
    isActive: false,
    version: 4,
    createdAt: T0,
    updatedAt: T1
  };

  it('reconstruye un servicio existente con su version sin registrar eventos', () => {
    const service = WashService.restore(row);

    expect(service.id).toBe(row.id);
    expect(service.price).toBe(35);
    expect(service.isActive).toBe(false);
    expect(service.version).toBe(4);
    expect(service.description).toBe('');
    expect(service.updatedAt).toEqual(T1);
    expect(service.pullDomainEvents()).toHaveLength(0);
  });

  it('valida los datos recibidos', () => {
    expect(() => WashService.restore({ ...row, priceCents: -1 })).toThrow(InvalidPriceError);
    expect(() => WashService.restore({ ...row, isActive: 'si' })).toThrow(InvalidServiceError);
    expect(() => WashService.restore({ ...row, version: 0 })).toThrow(InvalidServiceError);
  });
});

describe('WashService.toJSON', () => {
  it('serializa con fechas ISO y version', () => {
    const json = WashService.create(validProps()).toJSON();

    expect(json).toMatchObject({ name: 'Lavado completo', price: 80, currency: 'BOB', isActive: true, version: 1 });
    expect(json.createdAt).toBe(T0.toISOString());
  });
});
