import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { comoLista } from '../../api/client'
import { customerApi, ordersApi, paymentsApi } from '../../api/services'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Badge, Button, Encabezado, ErrorCaja, Field, Modal, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { METODOS_PAGO } from '../../config/navigation'
import { useApi } from '../../hooks/useApi'
import { bs, esHoy, fecha, idCorto } from '../../utils/format'

export default function Pagos() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const pagos = useApi(() => paymentsApi.listar(), [])
  const ordenes = useApi(() => ordersApi.listar(), [])
  const [filtro, setFiltro] = useState('')
  const [registrar, setRegistrar] = useState(null) // orden preseleccionada o {} para elegir

  const listaPagos = useMemo(() => comoLista(pagos.datos), [pagos.datos])
  const listaOrdenes = useMemo(() => comoLista(ordenes.datos), [ordenes.datos])
  const placaDe = useMemo(() => new Map(listaOrdenes.map((o) => [o.id, o.placaVehiculo])), [listaOrdenes])
  const pagadas = useMemo(() => new Set(listaPagos.map((p) => p.orderId)), [listaPagos])
  // Se cobran órdenes terminadas (listas o entregadas) que todavía no tienen pago.
  const porCobrar = listaOrdenes.filter((o) => (o.estado === 'LISTO' || o.estado === 'ENTREGADO') && !pagadas.has(o.id))

  // Desde la cola de lavados se llega con ?orden=<id>: si la orden no está pagada se abre el cobro,
  // y si ya lo está se filtra el historial para mostrar su pago.
  const ordenParam = params.get('orden')
  const ordenDeUrl = pagos.datos && ordenParam ? listaOrdenes.find((o) => o.id === ordenParam) : null
  const ordenDeUrlPagada = Boolean(ordenDeUrl && pagadas.has(ordenDeUrl.id))
  const modalOrden = registrar ?? (ordenDeUrl && !ordenDeUrlPagada ? ordenDeUrl : null)
  const filtroEfectivo = filtro || (ordenDeUrlPagada ? ordenDeUrl.id : '')
  const limpiarUrl = () => ordenParam && setParams({}, { replace: true })

  const visibles = listaPagos.filter((p) => {
    const q = filtroEfectivo.trim().toUpperCase()
    if (!q) return true
    return p.orderId.toUpperCase().includes(q) || (placaDe.get(p.orderId) || '').includes(q) || p.customerName.toUpperCase().includes(q)
  })
  const hoy = listaPagos.filter((p) => esHoy(p.paidAt))
  const totalHoy = hoy.reduce((t, p) => t + Number(p.amount), 0)
  const porMetodo = METODOS_PAGO.map((m) => ({
    ...m,
    total: hoy.filter((p) => p.method === m.valor).reduce((t, p) => t + Number(p.amount), 0),
  }))

  return (
    <>
      <Encabezado titulo="Pagos" subtitulo="Registro de cobros. No se procesa dinero real.">
        <Button icon="plus" onClick={() => setRegistrar({})}>Registrar pago</Button>
      </Encabezado>

      <div className="stats stats-4">
        <div className="stat stat-dark">
          <span className="stat-label">Cobrado hoy</span>
          <strong className="stat-value">{bs(totalHoy)}</strong>
          <small>{hoy.length} pago(s)</small>
        </div>
        {porMetodo.map((m) => (
          <div key={m.valor} className="stat">
            <span className="stat-label">{m.etiqueta}</span>
            <strong className="stat-value stat-value-sm">{bs(m.total)}</strong>
          </div>
        ))}
      </div>

      {porCobrar.length > 0 && (
        <Tarjeta titulo={`Por cobrar (${porCobrar.length})`}>
          <div className="por-cobrar">
            {porCobrar.map((o) => (
              <button key={o.id} type="button" className="por-cobrar-item" onClick={() => setRegistrar(o)}>
                <span className="placa">{o.placaVehiculo}</span>
                <span>{bs(o.precioTotal)}</span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Historial de pagos"
        acciones={
          <div className="search">
            <Icon name="search" size={18} />
            <input
              placeholder="Placa, cliente u orden"
              value={filtroEfectivo}
              onChange={(e) => {
                limpiarUrl()
                setFiltro(e.target.value)
              }}
              aria-label="Filtrar pagos"
            />
          </div>
        }
      >
        <ErrorCaja error={pagos.error} onReintentar={pagos.recargar} />
        {pagos.cargando && !pagos.datos ? (
          <Spinner />
        ) : visibles.length === 0 ? (
          <Vacio icono="payments" titulo="No hay pagos">{filtroEfectivo ? 'Ningún pago coincide con el filtro.' : 'Los pagos registrados aparecerán aquí.'}</Vacio>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Orden</th><th>Placa</th><th>Cliente</th><th>Método</th><th className="right">Monto</th></tr></thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td>{fecha(p.paidAt)}</td>
                    <td className="mono">#{idCorto(p.orderId)}</td>
                    <td>{placaDe.get(p.orderId) ? <span className="placa placa-sm">{placaDe.get(p.orderId)}</span> : <span className="muted">—</span>}</td>
                    <td>{p.customerName}</td>
                    <td><Badge tono={p.method === 'EFECTIVO' ? 'listo' : p.method === 'QR' ? 'proceso' : 'espera'}>{METODOS_PAGO.find((m) => m.valor === p.method)?.etiqueta ?? p.method}</Badge></td>
                    <td className="right strong">{bs(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {ordenDeUrlPagada && !filtro && (
        <p className="muted">La orden de {ordenDeUrl.placaVehiculo} ya tiene su pago registrado.</p>
      )}

      {modalOrden && (
        <RegistrarPagoModal
          ordenInicial={modalOrden.id ? modalOrden : null}
          porCobrar={porCobrar}
          onCerrar={() => {
            limpiarUrl()
            setRegistrar(null)
          }}
          onRegistrado={(p) => {
            limpiarUrl()
            setRegistrar(null)
            toast.ok(`Pago de ${bs(p.amount)} registrado. Se avisó al cliente.`)
            pagos.recargar()
          }}
        />
      )}
    </>
  )
}

function RegistrarPagoModal({ ordenInicial, porCobrar, onCerrar, onRegistrado }) {
  const [ordenId, setOrdenId] = useState(ordenInicial?.id ?? '')
  const [monto, setMonto] = useState(ordenInicial ? String(ordenInicial.precioTotal) : '')
  const [nombre, setNombre] = useState('')
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const opciones = ordenInicial && !porCobrar.some((o) => o.id === ordenInicial.id) ? [ordenInicial, ...porCobrar] : porCobrar
  const orden = opciones.find((o) => o.id === ordenId)

  // Al elegir la orden se completan el monto y, si la orden tiene cliente, su nombre (desde Customer).
  useEffect(() => {
    if (!orden) return undefined
    let vigente = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonto(String(orden.precioTotal))
    if (orden.clienteId) {
      customerApi.obtenerCliente(orden.clienteId).then((c) => vigente && setNombre(c.name)).catch(() => {})
    }
    return () => {
      vigente = false
    }
  }, [orden])

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      onRegistrado(await paymentsApi.registrar({ orderId: ordenId, customerName: nombre.trim(), amount: Number(monto), method: metodo }))
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo="Registrar pago" onCerrar={onCerrar} ancho={480}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Orden">
          <select required value={ordenId} onChange={(e) => setOrdenId(e.target.value)}>
            <option value="">Selecciona una orden terminada…</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>{o.placaVehiculo} · {o.servicios.join(', ')} · {bs(o.precioTotal)}</option>
            ))}
          </select>
        </Field>
        {opciones.length === 0 && <p className="field-hint">No hay órdenes listas o entregadas pendientes de pago.</p>}
        <Field label="Nombre del cliente"><input required value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <div className="form-grid-2">
          <Field label="Monto (Bs)"><input required type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
          <Field label="Método">
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {METODOS_PAGO.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" icon="check" loading={enviando}>Registrar</Button>
        </div>
      </form>
    </Modal>
  )
}
