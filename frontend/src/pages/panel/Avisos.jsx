import { useMemo, useState } from 'react'
import { comoLista } from '../../api/client'
import { notificationsApi, ordersApi } from '../../api/services'
import Icon from '../../components/Icon'
import { Badge, Button, Encabezado, ErrorCaja, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { EVENTOS_AVISO } from '../../config/navigation'
import { useApi } from '../../hooks/useApi'
import { fecha, idCorto } from '../../utils/format'

const TONO = {
  WashOrderCreated: 'espera',
  WashStarted: 'proceso',
  WashCompleted: 'listo',
  WashDelivered: 'entregado',
  PaymentRegistered: 'pago',
}
const ICONO = {
  WashOrderCreated: 'reception',
  WashStarted: 'play',
  WashCompleted: 'check',
  WashDelivered: 'handover',
  PaymentRegistered: 'payments',
}

export default function Avisos() {
  const avisos = useApi(() => notificationsApi.listar(), [], { intervaloMs: 15000 })
  const ordenes = useApi(() => ordersApi.listar(), [])
  const [tipo, setTipo] = useState('')
  const [placa, setPlaca] = useState('')

  const placaDe = useMemo(() => new Map(comoLista(ordenes.datos).map((o) => [o.id, o.placaVehiculo])), [ordenes.datos])
  const lista = comoLista(avisos.datos).filter((a) => {
    if (tipo && a.eventType !== tipo) return false
    const q = placa.trim().toUpperCase()
    if (q && !(placaDe.get(a.orderId) || '').includes(q)) return false
    return true
  })

  return (
    <>
      <Encabezado titulo="Avisos a clientes" subtitulo="Generados automáticamente por los eventos de Kafka de Wash Order y Payment.">
        <Button variant="ghost" icon="refresh" onClick={avisos.recargar}>Actualizar</Button>
      </Encabezado>

      <Tarjeta>
        <div className="toolbar">
          <div className="search search-block">
            <Icon name="search" size={18} />
            <input placeholder="Filtrar por placa" value={placa} onChange={(e) => setPlaca(e.target.value)} aria-label="Filtrar por placa" />
          </div>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de aviso">
            <option value="">Todos los avisos</option>
            {Object.entries(EVENTOS_AVISO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <ErrorCaja error={avisos.error} onReintentar={avisos.recargar} />
        {avisos.cargando && !avisos.datos ? (
          <Spinner />
        ) : lista.length === 0 ? (
          <Vacio icono="bell" titulo="Sin avisos">Cada cambio de estado de una orden y cada pago generan un aviso al cliente.</Vacio>
        ) : (
          <ol className="timeline">
            {lista.map((a) => (
              <li key={a.id} className={`timeline-item t-${TONO[a.eventType] || 'neutro'}`}>
                <span className="timeline-dot"><Icon name={ICONO[a.eventType] || 'bell'} size={16} /></span>
                <div className="timeline-body">
                  <div className="timeline-head">
                    <Badge tono={TONO[a.eventType] || 'neutro'}>{EVENTOS_AVISO[a.eventType] || a.eventType}</Badge>
                    {placaDe.get(a.orderId) && <span className="placa placa-sm">{placaDe.get(a.orderId)}</span>}
                    <span className="muted mono">#{idCorto(a.orderId)}</span>
                    <span className="spacer" />
                    <time className="muted">{fecha(a.createdAt)}</time>
                  </div>
                  <p>{a.message}</p>
                  <small className="muted">Para: {a.customerName}{a.customerPhone ? ` · ${a.customerPhone}` : ''} · {a.status}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Tarjeta>
    </>
  )
}
