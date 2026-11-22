const NotificationRepository = require('../../domain/NotificationRepository');
const Notification = require('../../domain/Notification');
const { pool } = require('./PostgresConnection');

class PostgresNotificationRepository extends NotificationRepository {
  async save(notification) {
    const query = `
      INSERT INTO notifications (order_id, customer_name, customer_phone, event_type, message, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      notification.orderId,
      notification.customerName,
      notification.customerPhone,
      notification.eventType,
      notification.message,
      notification.status,
      notification.createdAt
    ];

    const result = await pool.query(query, values);
    return this.mapRowToEntity(result.rows[0]);
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