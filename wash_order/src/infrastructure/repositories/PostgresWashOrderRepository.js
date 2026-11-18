const WashOrderRepository = require('../../domain/repositories/WashOrderRepository');
const { WashOrder } = require('../../domain/entities/WashOrder');
const { pool, inicializarBaseDatos } = require('../database/postgres');

class PostgresWashOrderRepository extends WashOrderRepository {
  constructor(conexion = pool) {
    super();
    this.conexion = conexion;
  }

  #mapearFilaAEntidad(fila) {
    return new WashOrder({
      id: fila.id,
      placaVehiculo: fila.placa_vehiculo,
      clienteId: fila.cliente_id ?? null,
      servicios: typeof fila.servicios === 'string' ? JSON.parse(fila.servicios) : fila.servicios,
      precioTotal: fila.precio_total !== null && fila.precio_total !== undefined ? Number(fila.precio_total) : 0,
      responsableId: fila.responsable_id,
      estado: fila.estado,
      fechaCreacion: fila.fecha_creacion instanceof Date ? fila.fecha_creacion.toISOString() : fila.fecha_creacion,
      fechaEntrega: fila.fecha_entrega instanceof Date ? fila.fecha_entrega.toISOString() : (fila.fecha_entrega ?? null)
    });
  }

  async save(orden) {
    await inicializarBaseDatos();

    const consulta = `
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
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        placa_vehiculo = EXCLUDED.placa_vehiculo,
        cliente_id = EXCLUDED.cliente_id,
        servicios = EXCLUDED.servicios,
        precio_total = EXCLUDED.precio_total,
        responsable_id = EXCLUDED.responsable_id,
        estado = EXCLUDED.estado,
        fecha_creacion = EXCLUDED.fecha_creacion,
        fecha_entrega = EXCLUDED.fecha_entrega
    `;

    await this.conexion.query(consulta, [
      orden.id,
      orden.placaVehiculo,
      orden.clienteId,
      JSON.stringify(orden.servicios),
      orden.precioTotal,
      orden.responsableId,
      orden.estado,
      orden.fechaCreacion,
      orden.fechaEntrega
    ]);

    return orden;
  }

  async findById(id) {
    await inicializarBaseDatos();

    const consulta = `
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
      WHERE id = $1
    `;

    const resultado = await this.conexion.query(consulta, [id]);

    if (resultado.rows.length === 0) {
      return null;
    }

    return this.#mapearFilaAEntidad(resultado.rows[0]);
  }

  async findByPlate(placaVehiculo) {
    await inicializarBaseDatos();

    const consulta = `
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
      WHERE placa_vehiculo = $1
      ORDER BY fecha_creacion DESC
    `;

    const resultado = await this.conexion.query(consulta, [placaVehiculo.trim().toUpperCase()]);
    return resultado.rows.map((fila) => this.#mapearFilaAEntidad(fila));
  }

  async getSummary() {
    await inicializarBaseDatos();

    const resultadoConteo = await this.conexion.query(`
      SELECT
        COUNT(*)::INT AS total,
        COALESCE(SUM(CASE WHEN estado = 'EN_ESPERA' THEN 1 ELSE 0 END), 0)::INT AS "enEspera",
        COALESCE(SUM(CASE WHEN estado = 'EN_PROCESO' THEN 1 ELSE 0 END), 0)::INT AS "enProceso",
        COALESCE(SUM(CASE WHEN estado = 'LISTO' THEN 1 ELSE 0 END), 0)::INT AS listo,
        COALESCE(SUM(CASE WHEN estado = 'ENTREGADO' THEN 1 ELSE 0 END), 0)::INT AS entregado
      FROM wash_orders
    `);

    const resumen = resultadoConteo.rows[0];

    const resultadoOrdenes = await this.conexion.query(`
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

    const ordenes = resultadoOrdenes.rows.map((fila) => this.#mapearFilaAEntidad(fila));

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

module.exports = PostgresWashOrderRepository;
