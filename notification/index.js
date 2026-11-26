require('dotenv').config();
const app = require('./src/app');
const { initDatabase, pool } = require('./src/infrastructure/database/PostgresConnection');
const PostgresNotificationRepository = require('./src/infrastructure/database/PostgresNotificationRepository');
const { NotifyFromEventCommand } = require('./src/application/commands/NotifyFromEventCommand');
const KafkaEventConsumer = require('./src/infrastructure/messaging/KafkaEventConsumer');

const PORT = process.env.PORT || 3004;

const separarLista = (valor, porDefecto) =>
  (valor || porDefecto).split(',').map((item) => item.trim()).filter(Boolean);

const startServer = async () => {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servicio Notification ejecutándose en el puerto ${PORT}`);
    });

    // Consumidor de eventos: los avisos de cambio de estado y de pago llegan por Kafka.
    const consumidor = new KafkaEventConsumer({
      brokers: separarLista(process.env.KAFKA_BROKERS, 'localhost:9092'),
      clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
      groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
      topics: separarLista(process.env.KAFKA_TOPICS, 'wash-order.order.events,payment.payment.registered'),
      notifyFromEvent: new NotifyFromEventCommand(new PostgresNotificationRepository())
    });
    consumidor.iniciar();

    let cerrando = false;
    const apagar = async (senal) => {
      if (cerrando) return;
      cerrando = true;
      console.log(`${senal} recibido, cerrando Notification Service...`);
      await new Promise((resolve) => server.close(resolve));
      await consumidor.detener();
      await pool.end().catch(() => {});
      process.exit(0);
    };
    process.on('SIGINT', () => apagar('SIGINT'));
    process.on('SIGTERM', () => apagar('SIGTERM'));
  } catch (error) {
    console.error('❌ Error al iniciar el servicio de notificaciones:', error);
    process.exit(1);
  }
};

startServer();
