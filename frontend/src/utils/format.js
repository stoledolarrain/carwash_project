const moneda = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaHora = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
const hora = new Intl.DateTimeFormat('es-BO', { timeStyle: 'short' })

export const bs = (n) => `Bs ${moneda.format(Number(n) || 0)}`

export function fecha(valor) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : fechaHora.format(d)
}

export function soloHora(valor) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : hora.format(d)
}

/** "hace 5 min", "hace 2 h"... para la cola de lavados. */
export function haceCuanto(valor) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export const esHoy = (valor) => {
  const d = new Date(valor)
  const hoy = new Date()
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate()
}

export const idCorto = (uuid) => (uuid ? String(uuid).slice(0, 8).toUpperCase() : '—')

export const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
