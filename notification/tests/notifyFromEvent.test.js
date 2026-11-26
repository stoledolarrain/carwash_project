const { NotifyFromEventCommand } = require('../src/application/commands/NotifyFromEventCommand');
const { parsearEvento, MensajeInvalidoError } = require('../src/infrastructure/messaging/eventParser');

/** Repositorio en memoria con la misma regla que PostgreSQL: un eventId solo se guarda una vez. */
class RepositorioEnMemoria {
  constructor() {
    this.filas = [];
  }
  async save(notification) {
    if (notification.eventId && this.filas.some((n) => n.eventId === notification.eventId)) return null;
    const guardada = { ...notification, id: this.filas.length + 1 };
    this.filas.push(guardada);
    return guardada;
  }
}

const silencioso = { log: () => {}, warn: () => {} };

function sobre(evento, datos, eventId = `evt-${evento}`) {
  return JSON.stringify({
    eventId,
    evento,
    origen: 'test',
    eventVersion: 1,
    fechaEmision: new Date().toISOString(),
    aggregateId: datos.id || 'x',
    datos
  });
}

const ORDEN = { id: '62c23933-fc8a-4bcd-96e9-63540643c56c', placaVehiculo: '4821-ABC', estado: 'LISTO', servicios: ['Lavado'] };

describe('Parser de eventos de Kafka', () => {
  it('convierte los cuatro eventos de Wash Order usando el id de la orden y la placa', () => {
    for (const evento of ['WashOrderCreated', 'WashStarted', 'WashCompleted', 'WashDelivered']) {
      expect(parsearEvento(Buffer.from(sobre(evento, ORDEN)))).toEqual({
        eventId: `evt-${evento}`,
        evento,
        orderId: ORDEN.id,
        placa: '4821-ABC'
      });
    }
  });

  it('convierte PaymentRegistered con monto formateado y nombre por defecto', () => {
    const evento = parsearEvento(sobre('PaymentRegistered', { id: '7', orderId: ORDEN.id, amount: 45, method: 'QR' }));
    expect(evento).toEqual({
      eventId: 'evt-PaymentRegistered',
      evento: 'PaymentRegistered',
      orderId: ORDEN.id,
      customerName: 'Cliente',
      monto: '45.00',
      metodo: 'QR'
    });
  });

  it('ignora eventos que no generan avisos', () => {
    expect(parsearEvento(sobre('ServiceCreated', { id: '1' }))).toBeNull();
  });

  it('rechaza mensajes con formato inválido', () => {
    expect(() => parsearEvento('no es json')).toThrow(MensajeInvalidoError);
    expect(() => parsearEvento(sobre('WashCompleted', { id: ORDEN.id }))).toThrow(/placaVehiculo/);
    expect(() => parsearEvento(JSON.stringify({ evento: 'WashCompleted' }))).toThrow(MensajeInvalidoError);
  });
});

describe('NotifyFromEventCommand', () => {
  it('crea el aviso de vehículo listo con la placa', async () => {
    const repo = new RepositorioEnMemoria();
    const command = new NotifyFromEventCommand(repo, silencioso);
    const resultado = await command.execute(parsearEvento(sobre('WashCompleted', ORDEN)));

    expect(resultado.creada).toBe(true);
    expect(resultado.notification).toMatchObject({
      orderId: ORDEN.id,
      eventType: 'WashCompleted',
      eventId: 'evt-WashCompleted',
      message: '¡Tu vehículo 4821-ABC está listo! Ya puedes pasar a recogerlo.'
    });
  });

  it('es idempotente: el mismo evento entregado dos veces genera un solo aviso', async () => {
    const repo = new RepositorioEnMemoria();
    const command = new NotifyFromEventCommand(repo, silencioso);
    const evento = parsearEvento(sobre('WashStarted', ORDEN, 'evt-repetido'));

    expect((await command.execute(evento)).creada).toBe(true);
    expect((await command.execute(evento)).creada).toBe(false);
    expect(repo.filas).toHaveLength(1);
  });

  it('crea el aviso de pago con monto y método', async () => {
    const repo = new RepositorioEnMemoria();
    const command = new NotifyFromEventCommand(repo, silencioso);
    const evento = parsearEvento(sobre('PaymentRegistered', { orderId: ORDEN.id, customerName: 'Andrea', amount: '60', method: 'TARJETA' }));
    const { notification } = await command.execute(evento);
    expect(notification.message).toBe('Gracias Andrea, registramos tu pago de Bs 60.00 vía TARJETA.');
    expect(notification.customerName).toBe('Andrea');
  });

  it('no crea nada para un tipo de evento sin plantilla', async () => {
    const repo = new RepositorioEnMemoria();
    const resultado = await new NotifyFromEventCommand(repo, silencioso).execute({ evento: 'Otro', eventId: 'x', orderId: 'y' });
    expect(resultado.creada).toBe(false);
    expect(repo.filas).toHaveLength(0);
  });
});
