// Cliente HTTP único del frontend. Todas las peticiones van al API Gateway (/api/...),
// nunca directo a un microservicio.

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

let obtenerToken = () => null
let alExpirarSesion = () => {}

/** Lo llama AuthProvider para que el cliente sepa qué token enviar y qué hacer ante un 401. */
export function configurarCliente({ getToken, onUnauthorized }) {
  obtenerToken = getToken
  alExpirarSesion = onUnauthorized
}

export class ApiError extends Error {
  constructor(status, message, code = null, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const MENSAJES_POR_ESTADO = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión no es válida o expiró. Vuelve a ingresar.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'El recurso cambió o ya existe. Actualiza e intenta de nuevo.',
  429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  502: 'El servicio no está disponible en este momento.',
  503: 'El servicio no está disponible en este momento.',
  504: 'El servicio tardó demasiado en responder.',
}

function normalizarDetalles(details) {
  if (!details) return []
  if (Array.isArray(details)) {
    return details.map((d) => (typeof d === 'string' ? d : d.message || JSON.stringify(d)))
  }
  if (typeof details === 'object') {
    return Object.entries(details).map(([campo, v]) => `${campo}: ${Array.isArray(v) ? v.join(', ') : v}`)
  }
  return [String(details)]
}

// Los microservicios responden errores en dos formatos:
// { error: { code, message, details } } (identity, catalog, customer, payment) y { error: "texto" } (wash_order, notification).
function leerError(status, body) {
  const porDefecto = MENSAJES_POR_ESTADO[status] || `Error inesperado (${status}).`
  if (body && typeof body === 'object') {
    if (typeof body.error === 'string') return new ApiError(status, body.error)
    if (body.error && typeof body.error === 'object') {
      return new ApiError(status, body.error.message || porDefecto, body.error.code, normalizarDetalles(body.error.details))
    }
    if (typeof body.message === 'string') return new ApiError(status, body.message)
    if (typeof body.detail === 'string') return new ApiError(status, body.detail)
  }
  return new ApiError(status, porDefecto)
}

function construirUrl(path, query) {
  const url = `${BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request(method, path, { body, query, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  const token = auth ? obtenerToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(construirUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifica que el API Gateway esté encendido.')
  }

  const texto = await res.text()
  let datos = null
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      datos = texto
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) alExpirarSesion()
    throw leerError(res.status, datos)
  }
  return datos
}

/** Algunos listados vienen como arreglo y otros paginados como { items, total }. */
export const comoLista = (r) => (Array.isArray(r) ? r : r?.items ?? [])
