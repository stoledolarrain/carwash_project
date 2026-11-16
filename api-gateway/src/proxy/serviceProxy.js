const http = require('node:http');
const https = require('node:https');
const { gatewayErrors } = require('../errors');

/** Encabezados que solo valen para una conexión (RFC 9110) y no se deben reenviar. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

function stripHopByHop(headers) {
  const listed = String(headers.connection || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(name) && !listed.includes(name)) {
      result[name] = value;
    }
  }
  return result;
}

function clientAddress(req) {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

/**
 * Reenvía la petición al microservicio que la atiende y transmite la respuesta tal cual (estado, encabezados y cuerpo).
 * El Gateway no lee ni transforma los cuerpos: no contiene lógica de negocio.
 *
 * - Conserva la ruta completa (/api/identity/... llega igual al servicio).
 * - Reenvía `Authorization` para que el servicio valide el token por su cuenta.
 * - Agrega `X-Request-Id` y `X-Forwarded-For/Proto/Host`. El Gateway es el punto de entrada,
 *   así que reemplaza cualquier `X-Forwarded-For` que mande el cliente (no se puede falsificar la IP).
 * - Errores de red: 503 si el servicio está caído, 504 si no responde a tiempo, 502 en otros casos.
 */
function createServiceProxy({ timeoutMs }) {
  return function serviceProxy(req, res, next) {
    const route = req.serviceRoute;
    const targetUrl = new URL(req.originalUrl, route.target);
    const transport = targetUrl.protocol === 'https:' ? https : http;

    const headers = stripHopByHop(req.headers);
    headers.host = targetUrl.host;
    headers['x-request-id'] = req.id;
    headers['x-forwarded-for'] = clientAddress(req);
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-host'] = req.get('host') || '';

    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      next(error);
    };

    const upstreamReq = transport.request(targetUrl, { method: req.method, headers }, (upstreamRes) => {
      settled = true;
      res.status(upstreamRes.statusCode);
      for (const [name, value] of Object.entries(stripHopByHop(upstreamRes.headers))) {
        // El X-Request-Id y CORS los define el Gateway.
        if (name === 'x-request-id' || name.startsWith('access-control-')) continue;
        res.setHeader(name, value);
      }
      upstreamRes.pipe(res);
      upstreamRes.on('error', () => res.destroy());
    });

    upstreamReq.setTimeout(timeoutMs, () => {
      upstreamReq.destroy(Object.assign(new Error('Tiempo de espera agotado'), { code: 'UPSTREAM_TIMEOUT' }));
    });

    upstreamReq.on('error', (err) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      let error;
      if (err.code === 'UPSTREAM_TIMEOUT') {
        error = gatewayErrors.gatewayTimeout(route.name);
      } else if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ECONNRESET'].includes(err.code)) {
        error = gatewayErrors.serviceUnavailable(route.name);
      } else {
        error = gatewayErrors.badGateway(route.name);
      }
      error.cause = err;
      fail(error);
    });

    // Si el cliente corta la conexión, no tiene sentido seguir esperando al servicio.
    res.on('close', () => {
      if (!res.writableFinished) upstreamReq.destroy();
    });

    req.pipe(upstreamReq);
  };
}

module.exports = { createServiceProxy, stripHopByHop };
