/** Error propio del Gateway con su código HTTP. Se responde con el mismo formato que los microservicios. */
class GatewayError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.code = code;
  }
}

const gatewayErrors = Object.freeze({
  unauthorized: (message = 'Se requiere un token de acceso válido.') => new GatewayError(401, 'INVALID_TOKEN', message),
  notFound: (method, path) => new GatewayError(404, 'NOT_FOUND', `Ruta no encontrada: ${method} ${path}`),
  serviceUnavailable: (service) =>
    new GatewayError(503, 'SERVICE_UNAVAILABLE', `El servicio ${service} no está disponible. Intente más tarde.`),
  gatewayTimeout: (service) =>
    new GatewayError(504, 'GATEWAY_TIMEOUT', `El servicio ${service} tardó demasiado en responder.`),
  badGateway: (service) => new GatewayError(502, 'BAD_GATEWAY', `Error de comunicación con el servicio ${service}.`)
});

module.exports = { GatewayError, gatewayErrors };
