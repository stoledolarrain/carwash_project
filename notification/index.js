require('dotenv').config();
const app = require('./src/app');
const { initDatabase } = require('./src/infrastructure/database/PostgresConnection');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Servicio Notification ejecutándose en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servicio de notificaciones:', error);
    process.exit(1);
  }
};

startServer();