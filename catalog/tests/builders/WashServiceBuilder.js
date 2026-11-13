const crypto = require('node:crypto');
const WashService = require('../../src/domain/entities/WashService');

/**
 * Patrón Builder (GoF) — Test Data Builder para `WashService`.
 *
 * Justificación arquitectónica:
 * - En producción, la creación y reconstrucción de `WashService` se resuelve de forma óptima
 *   mediante el patrón Factory Method (`WashService.create` y `WashService.restore`), evitando
 *   introducir una clase Builder artificial en el flujo de negocio.
 * - En las suites de pruebas, `WashService` tiene múltiples atributos (`id`, `name`, `description`,
 *   `price`, `currency`, `estimatedDuration`, `isActive`, `version`, `createdAt`, `updatedAt`).
 *   `WashServiceBuilder` permite construir paso a paso e inmutablemente agregados válidos,
 *   servicios inactivos, con versiones específicas o DTOs de entrada sin repetir datos de relleno.
 */
class WashServiceBuilder {
  constructor() {
    this.#props = {
      id: crypto.randomUUID(),
      name: 'Lavado Completo',
      description: 'Lavado exterior e interior completo',
      price: 80,
      currency: 'BOB',
      estimatedDuration: 45,
      isActive: true,
      version: 1,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z')
    };
  }

  #props;

  static aWashService() {
    return new WashServiceBuilder();
  }

  withId(id) {
    this.#props.id = id;
    return this;
  }

  withName(name) {
    this.#props.name = name;
    return this;
  }

  withDescription(description) {
    this.#props.description = description;
    return this;
  }

  withPrice(price, currency = 'BOB') {
    this.#props.price = price;
    this.#props.currency = currency;
    return this;
  }

  withEstimatedDuration(minutes) {
    this.#props.estimatedDuration = minutes;
    return this;
  }

  withVersion(version) {
    this.#props.version = version;
    return this;
  }

  withTimestamps(createdAt, updatedAt = createdAt) {
    this.#props.createdAt = new Date(createdAt);
    this.#props.updatedAt = new Date(updatedAt);
    return this;
  }

  inactive() {
    this.#props.isActive = false;
    return this;
  }

  active() {
    this.#props.isActive = true;
    return this;
  }

  /** Construye un agregado nuevo usando `WashService.create()` (con `ServiceCreated` pendiente). */
  buildNew() {
    return WashService.create({
      id: this.#props.id,
      name: this.#props.name,
      description: this.#props.description,
      price: this.#props.price,
      currency: this.#props.currency,
      estimatedDuration: this.#props.estimatedDuration,
      now: this.#props.createdAt
    });
  }

  /** Reconstruye un agregado existente usando `WashService.restore()` (sin eventos pendientes). */
  buildRestored() {
    return WashService.restore({
      id: this.#props.id,
      name: this.#props.name,
      description: this.#props.description,
      priceCents: Math.round(this.#props.price * 100),
      currency: this.#props.currency,
      estimatedDuration: this.#props.estimatedDuration,
      isActive: this.#props.isActive,
      version: this.#props.version,
      createdAt: this.#props.createdAt,
      updatedAt: this.#props.updatedAt
    });
  }

  /** Construye el payload de entrada para `CreateService` / `POST /api/catalog/admin/services`. */
  buildCreateInput() {
    return {
      name: this.#props.name,
      description: this.#props.description,
      price: this.#props.price,
      currency: this.#props.currency,
      estimatedDuration: this.#props.estimatedDuration
    };
  }
}

module.exports = WashServiceBuilder;
