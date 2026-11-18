const crypto = require('node:crypto');
const { Kafka, logLevel } = require('kafkajs');
const { EVENTOS, TOPIC_ORDENES, ORIGEN_SERVICIO } = require('../../domain/events/OrderEvents');

class KafkaOrderEventPublisher {
  #kafka;
  #producer;
  #conectado = false;

  constructor({
    brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
    clientId = process.env.KAFKA_CLIENT_ID || ORIGEN_SERVICIO,
    topic = process.env.KAFKA_ORDER_EVENT_TOPIC || TOPIC_ORDENES,
    producer = null
  } = {}) {
    this.brokers = brokers;
    this.clientId = clientId;
    this.topic = topic;
    this.#producer = producer;
  }

  #obtenerProducer() {
    if (!this.#producer) {
      this.#kafka = new Kafka({
        clientId: this.clientId,
        brokers: this.brokers,
        logLevel: logLevel.NOTHING,
        retry: {
          initialRetryTime: 200,
          retries: 2
        }
      });
      this.#producer = this.#kafka.producer();
    }
    return this.#producer;
  }

  async conectar() {
    if (this.#conectado) {
      return;
    }
    const producer = this.#obtenerProducer();
    await producer.connect();
    this.#conectado = true;
  }

  construirSobreEvento(nombreEvento, datos) {
    return {
      eventId: crypto.randomUUID(),
      evento: nombreEvento,
      origen: ORIGEN_SERVICIO,
      eventVersion: 1,
      fechaEmision: new Date().toISOString(),
      aggregateId: datos.id,
      datos
    };
  }

  async emitir(nombreEvento, datos) {
    if (!datos || !datos.id) {
      throw new Error('El evento requiere el ID de la orden (aggregateId) para publicar en Kafka.');
    }

    const sobreEvento = this.construirSobreEvento(nombreEvento, datos);
    const claveMensaje = String(sobreEvento.aggregateId);
    const valorSerializado = JSON.stringify(sobreEvento);

    try {
      await this.conectar();
      await this.#producer.send({
        topic: this.topic,
        messages: [
          {
            key: claveMensaje,
            value: valorSerializado
          }
        ]
      });
      console.log(
        `[KAFKA PUBLICADO] topic=${this.topic} key=${claveMensaje} evento=${sobreEvento.evento}:`,
        valorSerializado
      );
    } catch (error) {
      this.#conectado = false;
      console.warn(
        `[KAFKA AVISO] Broker no disponible (${error.message}). Evento registrado localmente topic=${this.topic} key=${claveMensaje}:`,
        valorSerializado
      );
    }

    return sobreEvento;
  }

  async desconectar() {
    if (!this.#producer || !this.#conectado) {
      this.#conectado = false;
      return;
    }
    try {
      await this.#producer.disconnect();
    } finally {
      this.#conectado = false;
    }
  }
}

const busEventos = new KafkaOrderEventPublisher();

module.exports = {
  KafkaOrderEventPublisher,
  busEventos,
  EVENTOS,
  TOPIC_ORDENES,
  ORIGEN_SERVICIO
};
