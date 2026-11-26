const { Kafka, logLevel } = require('kafkajs');
const { parsearEvento, MensajeInvalidoError } = require('./eventParser');

/**
 * Consumidor de Kafka de Notification. Escucha:
 *  - wash-order.order.events     -> avisos de orden recibida, en lavado, lista y entregada.
 *  - payment.payment.registered  -> aviso de pago registrado.
 *
 * - Lee desde el inicio de cada topic la primera vez (fromBeginning): no se pierden eventos publicados
 *   antes de que arranque. Como el command es idempotente por eventId, releer no duplica avisos.
 * - Un mensaje con formato inválido se registra y se descarta; no detiene al consumidor.
 * - Si Kafka no está disponible, reintenta cada `reintentoMs` sin tumbar la API HTTP del servicio.
 */
class KafkaEventConsumer {
  constructor({ brokers, clientId, groupId, topics, notifyFromEvent, logger = console, reintentoMs = 10000 }) {
    this.topics = topics;
    this.groupId = groupId;
    this.notifyFromEvent = notifyFromEvent;
    this.logger = logger;
    this.reintentoMs = reintentoMs;
    this.kafka = new Kafka({ clientId, brokers, logLevel: logLevel.NOTHING });
    this.consumer = null;
    this.detenido = false;
    this.temporizador = null;
  }

  async iniciar() {
    if (this.detenido) return;
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
    // Si el consumidor se cae por un error de red, se vuelve a iniciar con el mismo mecanismo.
    this.consumer.on(this.consumer.events.CRASH, ({ payload }) => {
      if (!payload.restart) this.programarReintento(`se detuvo (${payload.error.message})`);
    });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: this.topics, fromBeginning: true });
      await this.consumer.run({ eachMessage: (args) => this.procesar(args) });
      this.logger.log(`[KAFKA] Notification escuchando: ${this.topics.join(', ')}`);
    } catch (error) {
      this.programarReintento(`no disponible (${error.message})`);
    }
  }

  programarReintento(motivo) {
    if (this.detenido || this.temporizador) return;
    this.logger.warn(`[KAFKA AVISO] Kafka ${motivo}. Reintentando en ${this.reintentoMs / 1000}s...`);
    const anterior = this.consumer;
    this.consumer = null;
    Promise.resolve(anterior && anterior.disconnect()).catch(() => {});
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.iniciar();
    }, this.reintentoMs);
  }

  async procesar({ topic, partition, message }) {
    let evento;
    try {
      evento = parsearEvento(message.value);
    } catch (error) {
      if (error instanceof MensajeInvalidoError) {
        this.logger.warn(`[KAFKA AVISO] Mensaje descartado de ${topic}[${partition}] offset ${message.offset}: ${error.message}`);
        return;
      }
      throw error;
    }
    if (!evento) return; // Evento que no genera aviso.

    // Si falla la base de datos, el error se propaga: kafkajs no confirma el offset y reintenta el mensaje.
    await this.notifyFromEvent.execute(evento);
  }

  async detener() {
    this.detenido = true;
    clearTimeout(this.temporizador);
    if (this.consumer) await this.consumer.disconnect().catch(() => {});
  }
}

module.exports = KafkaEventConsumer;
