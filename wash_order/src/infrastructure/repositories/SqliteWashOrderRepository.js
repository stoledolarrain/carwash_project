const WashOrderRepository = require('../../domain/repositories/WashOrderRepository');
const { WashOrder } = require('../../domain/entities/WashOrder');
const baseDatos = require('../database/sqlite');

class SqliteWashOrderRepository extends WashOrderRepository {
  constructor(conexion = baseDatos) {
    super();
    this.conexion = conexion;
  }

  #mapearFilaAEntidad(fila) {
    return new WashOrder({
      id: fila.id,
      placaVehiculo: fila.placa_vehiculo,
      clienteId: fila.cliente_id ?? null,
      servicios: JSON.parse(fila.servicios),
      precioTotal: typeof fila.precio_total === 'number' ? fila.precio_total : 0,
      responsableId: fila.responsable_id,
      estado: fila.estado,
      fechaCreacion: fila.fecha_creacion,
      fechaEntrega: fila.fecha_entrega ?? null
    });
  }

  async save(orden) {
    const sentencia = this.conexion.prepare(`
      INSERT INTO wash_orders (
        id,
        placa_vehiculo,
        cliente_id,
        servicios,
        precio_total,
        responsable_id,
        estado,
        fecha_creacion,
        fecha_entrega
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        placa_vehiculo = excluded.placa_vehiculo,
        cliente_id = excluded.cliente_id,
        servicios = excluded.servicios,
        precio_total = excluded.precio_total,
        responsable_id = excluded.responsable_id,
        estado = excluded.estado,
        fecha_creacion = excluded.fecha_creacion,
        fecha_entrega = excluded.fecha_entrega
    `);

    sentencia.run(
      orden.id,
      orden.placaVehiculo,
      orden.clienteId,
      JSON.stringify(orden.servicios),
      orden.precioTotal,
      orden.responsableId,
      orden.estado,
      orden.fechaCreacion,
      orden.fechaEntrega
    );

    return orden;
  }

  async findById(id) {
    const sentencia = this.conexion.prepare(`
      SELECT
        id,
        placa_vehiculo,
        cliente_id,
        servicios,
        precio_total,
        responsable_id,
        estado,
        fecha_creacion,
        fecha_entrega
      FROM wash_orders
      WHERE id = ?
    `);

    const fila = sentencia.get(id);

    if (!fila) {
      return null;
    }

    return this.#mapearFilaAEntidad(fila);
  }

  async findByPlate(placaVehiculo) {
    const sentencia = this.conexion.prepare(`
      SELECT
        id,
        placa_vehiculo,
        cliente_id,
        servicios,
        precio_total,
        responsable_id,
        estado,
        fecha_creacion,
        fecha_entrega
      FROM wash_orders
      WHERE placa_vehiculo = ?
      ORDER BY fecha_creacion DESC
    `);

    const filas = sentencia.all(placaVehiculo.trim().toUpperCase());
    return filas.map((fila) => this.#mapearFilaAEntidad(fila));
  }

  async getSummary() {
    const sentenciaConteo = this.conexion.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'EN_ESPERA' THEN 1 ELSE 0 END) AS enEspera,
        SUM(CASE WHEN estado = 'EN_PROCESO' THEN 1 ELSE 0 END) AS enProceso,
        SUM(CASE WHEN estado = 'LISTO' THEN 1 ELSE 0 END) AS listo,
        SUM(CASE WHEN estado = 'ENTREGADO' THEN 1 ELSE 0 END) AS entregado
      FROM wash_orders
    `);

    const resumen = sentenciaConteo.get();

    const sentenciaOrdenes = this.conexion.prepare(`
      SELECT
        id,
        placa_vehiculo,
        cliente_id,
        servicios,
        precio_total,
        responsable_id,
        estado,
        fecha_creacion,
        fecha_entrega
      FROM wash_orders
      ORDER BY fecha_creacion DESC
    `);

    const filas = sentenciaOrdenes.all();
    const ordenes = filas.map((fila) => this.#mapearFilaAEntidad(fila));

    return {
      total: resumen.total || 0,
      enEspera: resumen.enEspera || 0,
      enProceso: resumen.enProceso || 0,
      listo: resumen.listo || 0,
      entregado: resumen.entregado || 0,
      ordenes
    };
  }
}

module.exports = SqliteWashOrderRepository;
