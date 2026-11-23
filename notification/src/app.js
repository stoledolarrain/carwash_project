const express = require('express');
const cors = require('cors');

const PostgresNotificationRepository = require('./infrastructure/database/PostgresNotificationRepository');
const SendNotificationCommand = require('./application/commands/SendNotificationCommand');
const GetNotificationsQuery = require('./application/queries/GetNotificationsQuery');
const NotificationController = require('./presentation/NotificationController');

const app = express();
app.use(cors());
app.use(express.json()); 

const notificationRepository = new PostgresNotificationRepository();
const sendNotificationCommand = new SendNotificationCommand(notificationRepository);
const getNotificationsQuery = new GetNotificationsQuery(notificationRepository);
const notificationController = new NotificationController(sendNotificationCommand, getNotificationsQuery);

app.post('/api/notifications', notificationController.send);
app.get('/api/notifications', notificationController.getAll);

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'UP' });
});

module.exports = app;