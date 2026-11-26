// Mapa de pantallas del panel: qué rol ve cada una y qué microservicio usa.
// El menú lateral y la protección de rutas se arman solo a partir de esta lista:
// agregar una pantalla es agregar una entrada aquí y su componente en App.jsx.

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  WASHER: 'WASHER',
})

export const NOMBRE_ROL = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  WASHER: 'Lavador',
}

const TODOS = [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.WASHER]
const OPERACION = [ROLES.ADMIN, ROLES.RECEPTIONIST]

export const PANTALLAS = [
  { ruta: '/panel', titulo: 'Resumen', icono: 'dashboard', roles: TODOS, servicio: 'wash_order' },
  { ruta: '/panel/recepcion', titulo: 'Recepción', icono: 'reception', roles: OPERACION, servicio: 'customer · catalog · wash_order' },
  { ruta: '/panel/lavados', titulo: 'Lavados', icono: 'queue', roles: TODOS, servicio: 'wash_order' },
  { ruta: '/panel/clientes', titulo: 'Clientes', icono: 'customers', roles: OPERACION, servicio: 'customer' },
  { ruta: '/panel/pagos', titulo: 'Pagos', icono: 'payments', roles: OPERACION, servicio: 'payment' },
  { ruta: '/panel/avisos', titulo: 'Avisos', icono: 'bell', roles: OPERACION, servicio: 'notification' },
  { ruta: '/panel/servicios', titulo: 'Servicios', icono: 'services', roles: [ROLES.ADMIN], servicio: 'catalog' },
  { ruta: '/panel/usuarios', titulo: 'Usuarios', icono: 'users', roles: [ROLES.ADMIN], servicio: 'identity' },
]

export const pantallasDelRol = (rol) => PANTALLAS.filter((p) => p.roles.includes(rol))
export const puedeVer = (rol, ruta) => PANTALLAS.some((p) => p.ruta === ruta && p.roles.includes(rol))

// Estados de una orden (State pattern de wash_order).
export const ESTADOS_ORDEN = {
  EN_ESPERA: { etiqueta: 'En espera', tono: 'espera' },
  EN_PROCESO: { etiqueta: 'En proceso', tono: 'proceso' },
  LISTO: { etiqueta: 'Listo', tono: 'listo' },
  ENTREGADO: { etiqueta: 'Entregado', tono: 'entregado' },
}

export const METODOS_PAGO = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'QR', etiqueta: 'QR' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
]

export const EVENTOS_AVISO = {
  WashOrderCreated: 'Orden recibida',
  WashStarted: 'Lavado iniciado',
  WashCompleted: 'Vehículo listo',
  WashDelivered: 'Vehículo entregado',
  PaymentRegistered: 'Pago registrado',
}
