const NotificationRepository = require('../../domain/NotificationRepository');
const Notification = require('../../domain/Notification');
const { pool } = require('./PostgresConnection');

class PostgresNotificationRepository extends NotificationRepository {
  /**
   * Guarda la notificación. Si trae `eventId` y ese evento ya generó una notificación,
   * no inserta nada y devuelve null (el evento llegó duplicado desde Kafka).
   */
  async save(notification) {
    const query = `
      INSERT INTO notifications (event_id, order_id, customer_name, customer_phone, event_type, message, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING *;
    `;
    const values = [
      notification.eventId,
      notification.orderId,
      notification.customerName,
      notification.customerPhone,
      notification.eventType,
      notification.message,
      notification.status,
      notification.createdAt
    ];

    const result = await pool.query(query, values);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAll() {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByOrderId(orderId) {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  mapRowToEntity(row) {
    return new Notification({
      id: row.id,
      eventId: row.event_id,
      orderId: row.order_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      eventType: row.event_type,
      message: row.message,
      status: row.status,
      createdAt: row.created_at
    });
  }
}

module.exports = PostgresNotificationRepository;
