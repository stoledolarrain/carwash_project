const { ServiceNotFoundError } = require('../../application/errors/ApplicationErrors');
const {
  validateUuidParam,
  parsePublicListQuery,
  parseAdminListQuery,
  validateCreateServiceBody,
  validateUpdateServiceBody,
  validateChangePriceBody,
  validateEmptyActionBody,
  validateBatchServicesBody
} = require('../validators/catalogValidators');

/**
 * Controlador HTTP de Catalog Service.
 * Valida parámetros/cuerpo HTTP, delega en los Commands y Queries de Application
 * y devuelve la respuesta JSON con el código de estado correspondiente.
 */
class CatalogController {
  /**
   * @param {{ commands: object, queries: object }} deps
   */
  constructor({ commands, queries }) {
    if (!commands || !queries) {
      throw new Error('CatalogController requires both commands and queries.');
    }
    this.commands = commands;
    this.queries = queries;
  }

  /** GET /api/catalog/services — Lista pública paginada de servicios activos. */
  async listPublicServices(req, res) {
    const pagination = parsePublicListQuery(req.query);
    const result = await this.queries.getActiveServices.execute(pagination);
    res.status(200).json(result);
  }

  /** GET /api/catalog/services/:id — Detalle público (oculta inactivos con 404). */
  async getPublicServiceById(req, res) {
    const id = validateUuidParam(req.params.id);
    const service = await this.queries.getServiceById.execute({ id });

    if (!service.isActive) {
      throw new ServiceNotFoundError(id);
    }

    res.status(200).json(service);
  }

  /** POST /api/catalog/services/batch — Consulta por lote para Wash Order (incluye inactivos y notFound). */
  async getServicesBatch(req, res) {
    const { ids } = validateBatchServicesBody(req.body);
    const result = await this.queries.getServicesByIds.execute({ ids });
    res.status(200).json(result);
  }

  /** GET /api/catalog/admin/services — Lista administrativa (activos e inactivos, paginación y filtro). */
  async listAdminServices(req, res) {
    const filter = parseAdminListQuery(req.query);
    const result = await this.queries.getAllServices.execute(filter);
    res.status(200).json(result);
  }

  /** POST /api/catalog/admin/services — Crea un nuevo servicio de lavado. */
  async createService(req, res) {
    const payload = validateCreateServiceBody(req.body);
    const created = await this.commands.createService.execute(payload);
    res.status(201).json(created);
  }

  /** PUT /api/catalog/admin/services/:id — Actualiza datos generales (name, description, estimatedDuration). */
  async updateService(req, res) {
    const id = validateUuidParam(req.params.id);
    const changes = validateUpdateServiceBody(req.body);
    const updated = await this.commands.updateService.execute({ id, ...changes });
    res.status(200).json(updated);
  }

  /** PATCH /api/catalog/admin/services/:id/price — Actualiza el precio del servicio. */
  async changeServicePrice(req, res) {
    const id = validateUuidParam(req.params.id);
    const { price, currency } = validateChangePriceBody(req.body);
    const updated = await this.commands.changeServicePrice.execute({ id, price, currency });
    res.status(200).json(updated);
  }

  /** PATCH /api/catalog/admin/services/:id/activate — Activa un servicio inactivo. */
  async activateService(req, res) {
    const id = validateUuidParam(req.params.id);
    validateEmptyActionBody(req.body);
    const updated = await this.commands.activateService.execute({ id });
    res.status(200).json(updated);
  }

  /** PATCH /api/catalog/admin/services/:id/deactivate — Desactiva un servicio activo. */
  async deactivateService(req, res) {
    const id = validateUuidParam(req.params.id);
    validateEmptyActionBody(req.body);
    const updated = await this.commands.deactivateService.execute({ id });
    res.status(200).json(updated);
  }
}

module.exports = CatalogController;
