class WashOrderController {
  constructor({
    createOrderCommand,
    assignOrderCommand,
    completeOrderCommand,
    deliverOrderCommand,
    getOrdersSummaryQuery,
    getOrderByIdQuery,
    getOrdersByPlateQuery
  }) {
    this.createOrderCommand = createOrderCommand;
    this.assignOrderCommand = assignOrderCommand;
    this.completeOrderCommand = completeOrderCommand;
    this.deliverOrderCommand = deliverOrderCommand;
    this.getOrdersSummaryQuery = getOrdersSummaryQuery;
    this.getOrderByIdQuery = getOrderByIdQuery;
    this.getOrdersByPlateQuery = getOrdersByPlateQuery;
  }

  crearOrden = async (req, res) => {
    try {
      const { placaVehiculo, clienteId, servicios, precioTotal } = req.body;
      const orden = await this.createOrderCommand.ejecutar({
        placaVehiculo,
        clienteId,
        servicios,
        precioTotal
      });
      return res.status(201).json(orden);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  };

  iniciarLavado = async (req, res) => {
    try {
      const { id } = req.params;
      const { responsableId } = req.body;
      const orden = await this.assignOrderCommand.ejecutar({
        id,
        responsableId
      });
      return res.status(200).json(orden);
    } catch (error) {
      const codigoEstado = error.message.includes('No se encontró') ? 404 : 400;
      return res.status(codigoEstado).json({ error: error.message });
    }
  };

  completarLavado = async (req, res) => {
    try {
      const { id } = req.params;
      const orden = await this.completeOrderCommand.ejecutar({ id });
      return res.status(200).json(orden);
    } catch (error) {
      const codigoEstado = error.message.includes('No se encontró') ? 404 : 400;
      return res.status(codigoEstado).json({ error: error.message });
    }
  };

  entregarVehiculo = async (req, res) => {
    try {
      const { id } = req.params;
      const orden = await this.deliverOrderCommand.ejecutar({ id });
      return res.status(200).json(orden);
    } catch (error) {
      const codigoEstado = error.message.includes('No se encontró') ? 404 : 400;
      return res.status(codigoEstado).json({ error: error.message });
    }
  };

  obtenerResumen = async (req, res) => {
    try {
      const resumen = await this.getOrdersSummaryQuery.ejecutar();
      return res.status(200).json(resumen);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  obtenerOrdenPorId = async (req, res) => {
    try {
      const { id } = req.params;
      const orden = await this.getOrderByIdQuery.ejecutar({ id });
      return res.status(200).json(orden);
    } catch (error) {
      const codigoEstado = error.message.includes('No se encontró') ? 404 : 400;
      return res.status(codigoEstado).json({ error: error.message });
    }
  };

  obtenerHistorialPorPlaca = async (req, res) => {
    try {
      const placaVehiculo = req.params.placa || req.query.placa;
      if (!placaVehiculo) {
        const resumen = await this.getOrdersSummaryQuery.ejecutar();
        return res.status(200).json(resumen.ordenes);
      }

      const ordenes = await this.getOrdersByPlateQuery.ejecutar({ placaVehiculo });
      return res.status(200).json(ordenes);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  };
}

module.exports = WashOrderController;
