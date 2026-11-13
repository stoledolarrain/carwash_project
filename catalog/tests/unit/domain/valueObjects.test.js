const ServiceName = require('../../../src/domain/value-objects/ServiceName');
const Money = require('../../../src/domain/value-objects/Money');
const Duration = require('../../../src/domain/value-objects/Duration');
const {
  DomainError,
  InvalidServiceNameError,
  InvalidPriceError,
  InvalidDurationError,
  InvalidCurrencyError
} = require('../../../src/domain/errors/DomainErrors');

describe('ServiceName', () => {
  it('acepta un nombre válido y elimina espacios sobrantes', () => {
    expect(new ServiceName('  Lavado completo  ').value).toBe('Lavado completo');
  });

  it.each([['vacío', ''], ['solo espacios', '   '], ['undefined', undefined], ['null', null], ['número', 5]])(
    'rechaza nombre %s',
    (_, value) => {
      expect(() => new ServiceName(value)).toThrow(InvalidServiceNameError);
    }
  );

  it('acepta exactamente 100 caracteres y rechaza 101', () => {
    expect(new ServiceName('a'.repeat(100)).value).toHaveLength(100);
    expect(() => new ServiceName('a'.repeat(101))).toThrow(InvalidServiceNameError);
  });

  it('compara por valor y es inmutable', () => {
    const name = new ServiceName('Encerado');
    expect(name.equals(new ServiceName('Encerado'))).toBe(true);
    expect(name.equals(new ServiceName('Pulido'))).toBe(false);
    expect(Object.isFrozen(name)).toBe(true);
  });
});

describe('Money', () => {
  it('guarda centavos enteros y usa BOB por defecto', () => {
    const money = Money.fromDecimal(80.5);
    expect(money.cents).toBe(8050);
    expect(money.amount).toBe(80.5);
    expect(money.currency).toBe('BOB');
  });

  it('evita errores de punto flotante', () => {
    expect(Money.fromDecimal(0.1 + 0.2).cents).toBe(30);
    expect(Money.fromDecimal(19.99).cents).toBe(1999);
  });

  it('permite precio cero', () => {
    expect(Money.fromDecimal(0).cents).toBe(0);
  });

  it('rechaza precios negativos', () => {
    expect(() => Money.fromDecimal(-1)).toThrow(InvalidPriceError);
    expect(() => Money.fromCents(-1)).toThrow(InvalidPriceError);
  });

  it.each([['NaN', NaN], ['Infinity', Infinity], ['texto', '10'], ['null', null]])(
    'rechaza importe %s',
    (_, value) => {
      expect(() => Money.fromDecimal(value)).toThrow(InvalidPriceError);
    }
  );

  it('rechaza más de 2 decimales y centavos no enteros', () => {
    expect(() => Money.fromDecimal(10.005)).toThrow(InvalidPriceError);
    expect(() => Money.fromCents(10.5)).toThrow(InvalidPriceError);
  });

  it('rechaza monedas distintas de BOB', () => {
    expect(() => Money.fromDecimal(10, 'USD')).toThrow(InvalidCurrencyError);
  });

  it('compara por valor', () => {
    expect(Money.fromDecimal(10).equals(Money.fromCents(1000))).toBe(true);
    expect(Money.fromDecimal(10).equals(Money.fromDecimal(11))).toBe(false);
  });
});

describe('Duration', () => {
  it('acepta minutos enteros positivos', () => {
    expect(Duration.ofMinutes(45).minutes).toBe(45);
  });

  it.each([0, -5])('rechaza duración %s', (value) => {
    expect(() => new Duration(value)).toThrow(InvalidDurationError);
  });

  it.each([['decimal', 1.5], ['texto', '30'], ['undefined', undefined], ['NaN', NaN]])(
    'rechaza duración %s',
    (_, value) => {
      expect(() => new Duration(value)).toThrow(InvalidDurationError);
    }
  );
});

describe('DomainError', () => {
  it('los errores específicos heredan de DomainError y exponen un código', () => {
    const error = new InvalidPriceError('x');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('INVALID_PRICE');
    expect(error.name).toBe('InvalidPriceError');
  });
});
