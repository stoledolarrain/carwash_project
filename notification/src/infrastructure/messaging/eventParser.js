/**
 * Convierte un mensaje de Kafka (el sobre común de todos los servicios) en el evento que entiende
 * NotifyFromEventCommand. Devuelve null si el evento no le interesa a Notification.
 * Lanza un error si el mensaje no tiene el formato esperado.
 *
 * Sobre común: { eventId, evento, origen, eventVersion, fechaEmision, aggregateId, datos }
 */
const EVENTOS_DE_ORDEN = ['WashOrderCreated', 'WashStarted', 'WashCompleted', 'WashDelivered'];

class MensajeInvalidoError extends Error {}

function textoObligatorio(valor, campo) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new MensajeInvalidoError(`Falta el campo "${campo}" en el evento.`);
  }
  return valor.trim();
}

function parsearEvento(valorCrudo) {
  let sobre;
  try {
    sobre = JSON.parse(Buffer.isBuffer(valorCrudo) ? valorCrudo.toString('utf8') : valorCrudo);
  } catch {
    throw new MensajeInvalidoError('El mensaje no es un JSON válido.');
  }
  if (!sobre || typeof sobre !== 'object' || !sobre.datos || typeof sobre.datos !== 'object') {
    throw new MensajeInvalidoError('El mensaje no tiene el sobre de evento esperado.');
  }

  const evento = textoObligatorio(sobre.evento, 'evento');
  const eventId = textoObligatorio(sobre.eventId, 'eventId');
  const { datos } = sobre;

  if (EVENTOS_DE_ORDEN.includes(evento)) {
    return {
      eventId,
      evento,
      orderId: textoObligatorio(datos.id, 'datos.id'),
      placa: textoObligatorio(datos.placaVehiculo, 'datos.placaVehiculo')
    };
  }

  if (evento === 'PaymentRegistered') {
    const monto = Number(datos.amount);
    if (!Number.isFinite(monto)) {
      throw new MensajeInvalidoError('El campo "datos.amount" debe ser numérico.');
    }
    return {
      eventId,
      evento,
      orderId: textoObligatorio(datos.orderId, 'datos.orderId'),
      customerName: typeof datos.customerName === 'string' && datos.customerName.trim() ? datos.customerName.trim() : 'Cliente',
      monto: monto.toFixed(2),
      metodo: textoObligatorio(datos.method, 'datos.method')
    };
  }

  return null;
}

module.exports = { parsearEvento, MensajeInvalidoError, EVENTOS_DE_ORDEN };
