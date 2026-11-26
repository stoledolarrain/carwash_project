// Un objeto por microservicio. Cada función es un endpoint del API Gateway.
import { request } from './client'

const id = encodeURIComponent

export const identityApi = {
  login: (email, password) => request('POST', '/api/identity/auth/login', { body: { email, password }, auth: false }),
  me: () => request('GET', '/api/identity/auth/me'),
  cambiarMiPassword: (currentPassword, newPassword) =>
    request('PATCH', '/api/identity/auth/me/password', { body: { currentPassword, newPassword } }),
  listarUsuarios: (query) => request('GET', '/api/identity/users', { query }),
  crearUsuario: (datos) => request('POST', '/api/identity/users', { body: datos }),
  actualizarNombre: (userId, fullName) => request('PATCH', `/api/identity/users/${id(userId)}`, { body: { fullName } }),
  cambiarRol: (userId, role) => request('PATCH', `/api/identity/users/${id(userId)}/role`, { body: { role } }),
  restablecerPassword: (userId, newPassword) =>
    request('PATCH', `/api/identity/users/${id(userId)}/password`, { body: { newPassword } }),
  activar: (userId) => request('PATCH', `/api/identity/users/${id(userId)}/activate`, { body: {} }),
  desactivar: (userId) => request('PATCH', `/api/identity/users/${id(userId)}/deactivate`, { body: {} }),
  roles: () => request('GET', '/api/identity/roles'),
}

export const catalogApi = {
  // Público: lo usa también la página de inicio sin sesión.
  serviciosActivos: () => request('GET', '/api/catalog/services', { auth: false }),
  listarAdmin: (query) => request('GET', '/api/catalog/admin/services', { query }),
  crear: (datos) => request('POST', '/api/catalog/admin/services', { body: datos }),
  actualizar: (serviceId, datos) => request('PUT', `/api/catalog/admin/services/${id(serviceId)}`, { body: datos }),
  cambiarPrecio: (serviceId, price) =>
    request('PATCH', `/api/catalog/admin/services/${id(serviceId)}/price`, { body: { price } }),
  activar: (serviceId) => request('PATCH', `/api/catalog/admin/services/${id(serviceId)}/activate`, { body: {} }),
  desactivar: (serviceId) => request('PATCH', `/api/catalog/admin/services/${id(serviceId)}/deactivate`, { body: {} }),
}

export const customerApi = {
  buscarClientes: (query) => request('GET', '/api/customer/customers', { query }),
  obtenerCliente: (customerId) => request('GET', `/api/customer/customers/${id(customerId)}`),
  registrarCliente: (datos) => request('POST', '/api/customer/customers', { body: datos }),
  actualizarCliente: (customerId, datos) => request('PATCH', `/api/customer/customers/${id(customerId)}`, { body: datos }),
  activarCliente: (customerId) => request('PATCH', `/api/customer/customers/${id(customerId)}/activate`),
  desactivarCliente: (customerId) => request('PATCH', `/api/customer/customers/${id(customerId)}/deactivate`),
  vehiculosDeCliente: (customerId) => request('GET', `/api/customer/customers/${id(customerId)}/vehicles`),
  historialDeCliente: (customerId, query) =>
    request('GET', `/api/customer/customers/${id(customerId)}/history`, { query }),
  registrarVehiculo: (datos) => request('POST', '/api/customer/vehicles', { body: datos }),
  vehiculoPorPlaca: (plate) => request('GET', `/api/customer/vehicles/by-plate/${id(plate)}`),
  actualizarVehiculo: (vehicleId, datos) => request('PATCH', `/api/customer/vehicles/${id(vehicleId)}`, { body: datos }),
  cambiarPropietario: (vehicleId, customerId) =>
    request('PATCH', `/api/customer/vehicles/${id(vehicleId)}/customer`, { body: { customerId } }),
}

export const ordersApi = {
  resumen: () => request('GET', '/api/orders/summary'),
  listar: () => request('GET', '/api/orders'),
  obtener: (orderId) => request('GET', `/api/orders/${id(orderId)}`),
  porPlaca: (placa) => request('GET', `/api/orders/vehicle/${id(placa)}`),
  crear: (datos) => request('POST', '/api/orders', { body: datos }),
  iniciar: (orderId, responsableId) => request('POST', `/api/orders/${id(orderId)}/start`, { body: { responsableId } }),
  completar: (orderId) => request('POST', `/api/orders/${id(orderId)}/complete`, { body: {} }),
  entregar: (orderId) => request('POST', `/api/orders/${id(orderId)}/deliver`, { body: {} }),
}

export const paymentsApi = {
  listar: (orderId) => request('GET', '/api/payments', { query: { orderId } }),
  registrar: (datos) => request('POST', '/api/payments', { body: datos }),
}

export const notificationsApi = {
  listar: (orderId) => request('GET', '/api/notifications', { query: { orderId } }),
}
