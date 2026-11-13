/**
 * Convierte un WashService en un objeto simple (sin exponer su estado privado).
 * Estructura única para todos los commands y queries.
 */
function toServiceDto(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price: service.price,
    currency: service.currency,
    estimatedDuration: service.estimatedDuration,
    isActive: service.isActive,
    version: service.version,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString()
  };
}

module.exports = { toServiceDto };
