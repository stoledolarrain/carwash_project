class GetOrdersSummaryQuery {
  constructor(repositorioOrdenes) {
    this.repositorioOrdenes = repositorioOrdenes;
  }

  async ejecutar() {
    return this.repositorioOrdenes.getSummary();
  }
}

module.exports = GetOrdersSummaryQuery;
