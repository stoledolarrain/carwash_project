class GetOrderByIdQuery {
  constructor(repositorioOrdenes) {
    this.repositorioOrdenes = repositorioOrdenes;
  }

  async ejecutar({ id }) {
    const orden = await this.repositorioOrdenes.findById(id);

    if (!orden) {
      throw new Error(`No se encontró la orden con ID ${id}.`);
    }

    return orden;
  }
}

module.exports = GetOrderByIdQuery;
