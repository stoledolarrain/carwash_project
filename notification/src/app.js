const express = require('express');
const cors = require('cors');

const PostgresNotificationRepository = require('./infrastructure/database/PostgresNotificationRepository');
const SendNotificationCommand = require('./application/commands/SendNotificationCommand');
const GetNotificationsQuery = require('./application/queries/GetNotificationsQuery');
const NotificationController = require('./presentation/NotificationController');
const { cargarConfiguracionJwt, crearAutenticacionJwt } = require('./infrastructure/security/autenticacionJwt');
const { requerirRol, ROLES_NOTIFICACIONES } = require('./presentation/middlewares/requerirRol');

// Lanza un error al cargar si falta JWT_SECRET: el servicio no arranca sin poder autenticar.
const autenticar = crearAutenticacionJwt(cargarConfiguracionJwt());

const app = express();
app.use(cors());
app.use(express.json()); 

const notificationRepository = new PostgresNotificationRepository();
const sendNotificationCommand = new SendNotificationCommand(notificationRepository);
const getNotificationsQuery = new GetNotificationsQuery(notificationRepository);
const notificationController = new NotificationController(sendNotificationCommand, getNotificationsQuery);

// Todas las rutas de notificaciones exigen un JWT válido de Identity Service y rol ADMIN o RECEPTIONIST.
const protegido = [autenticar, requerirRol(...ROLES_NOTIFICACIONES)];
app.post('/api/notifications', ...protegido, notificationController.send);
app.get('/api/notifications', ...protegido, notificationController.getAll);

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'UP' });
});

module.exports = app;