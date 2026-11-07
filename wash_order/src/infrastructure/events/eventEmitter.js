const crypto = require('node:crypto');
const EventEmitter = require('node:events');
const { EVENTOS } = require('../../domain/events/OrderEvents');

class BusEventos extends EventEmitter {
  emitir(nombreEvento, datos) {
    const evento = {
      eventId: crypto.randomUUID(),
      evento: nombreEvento,
      eventVersion: 1,
      fechaEmision: new Date().toISOString(),
      aggregateId: datos.id,
      datos
    };

    this.emit(nombreEvento, evento);
  }
}

const busEventos = new BusEventos();

Object.values(EVENTOS).forEach((tipoEvento) => {
  busEventos.on(tipoEvento, async (evento) => {
    console.log(`[EVENTO EMITIDO] ${evento.evento}:`, JSON.stringify(evento));

    // Integración opcional con Notification Service (si está configurado por variable de entorno)
    const urlNotificaciones = process.env.NOTIFICATION_SERVICE_URL;
    if (urlNotificaciones) {
      try {
        await fetch(urlNotificaciones, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evento)
        });
      } catch (error) {
        console.warn(`[AVISO] No se pudo enviar el evento ${evento.evento} a Notification Service: ${error.message}`);
      }
    }
  });
});

module.exports = {
  busEventos,
  EVENTOS
};
