import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { comoLista } from '../../api/client'
import { ordersApi, paymentsApi } from '../../api/services'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/Icon'
import { Encabezado, ErrorCaja, EstadoBadge, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { ROLES } from '../../config/navigation'
import { useApi } from '../../hooks/useApi'
import { usePersonal } from '../../hooks/usePersonal'
import { bs, esHoy, haceCuanto } from '../../utils/format'

const TARJETAS = [
  { clave: 'enEspera', titulo: 'En espera', tono: 'espera', icono: 'clock' },
  { clave: 'enProceso', titulo: 'En proceso', tono: 'proceso', icono: 'services' },
  { clave: 'listo', titulo: 'Listos para entregar', tono: 'listo', icono: 'check' },
  { clave: 'entregado', titulo: 'Entregados', tono: 'entregado', icono: 'handover' },
]

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function Resumen() {
  const { usuario, rol } = useAuth()
  const personal = usePersonal()
  const veePagos = rol !== ROLES.WASHER
  const resumen = useApi(() => ordersApi.resumen(), [], { intervaloMs: 15000 })
  const pagos = useApi(() => (veePagos ? paymentsApi.listar() : Promise.resolve([])), [veePagos])

  const ordenes = useMemo(() => resumen.datos?.ordenes ?? [], [resumen.datos])
  const ingresosHoy = useMemo(
    () => comoLista(pagos.datos).filter((p) => esHoy(p.paidAt)).reduce((t, p) => t + Number(p.amount || 0), 0),
    [pagos.datos],
  )
  const ordenesHoy = ordenes.filter((o) => esHoy(o.fechaCreacion)).length
  const misLavados = ordenes.filter((o) => o.responsableId === usuario?.id && o.estado === 'EN_PROCESO')
  const recientes = ordenes.slice(0, 8)

  return (
    <>
      <Encabezado titulo={`${saludo()}, ${usuario?.fullName?.split(' ')[0] ?? ''}`} subtitulo="Así va el car wash en este momento.">
        {rol !== ROLES.WASHER && (
          <Link to="/panel/recepcion" className="btn btn-primary">
            <Icon name="plus" size={18} /> <span>Nueva orden</span>
          </Link>
        )}
      </Encabezado>

      <ErrorCaja error={resumen.error} onReintentar={resumen.recargar} />

      <div className="stats">
        {TARJETAS.map((t) => (
          <div key={t.clave} className={`stat stat-${t.tono}`}>
            <span className="stat-icon"><Icon name={t.icono} size={22} /></span>
            <span className="stat-label">{t.titulo}</span>
            <strong className="stat-value">{resumen.datos ? resumen.datos[t.clave] : '—'}</strong>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Tarjeta
          titulo="Órdenes recientes"
          acciones={<Link to="/panel/lavados" className="link">Ver cola completa <Icon name="arrow" size={16} /></Link>}
        >
          {resumen.cargando && !resumen.datos ? (
            <Spinner />
          ) : recientes.length === 0 ? (
            <Vacio icono="car" titulo="Aún no hay órdenes">Las órdenes creadas en recepción aparecerán aquí.</Vacio>
          ) : (
            <ul className="lista-ordenes">
              {recientes.map((o) => (
                <li key={o.id}>
                  <span className="placa">{o.placaVehiculo}</span>
                  <span className="lista-ordenes-info">
                    <strong>{o.servicios.join(', ')}</strong>
                    <small>{personal.nombre(o.responsableId)} · {haceCuanto(o.fechaCreacion)}</small>
                  </span>
                  <span className="lista-ordenes-precio">{bs(o.precioTotal)}</span>
                  <EstadoBadge estado={o.estado} />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="stack">
          {veePagos && (
            <div className="kpi kpi-dark">
              <span>Ingresos de hoy</span>
              <strong>{pagos.cargando ? '…' : bs(ingresosHoy)}</strong>
              <small>{comoLista(pagos.datos).filter((p) => esHoy(p.paidAt)).length} pagos registrados</small>
            </div>
          )}
          <div className="kpi">
            <span>Órdenes recibidas hoy</span>
            <strong>{resumen.datos ? ordenesHoy : '—'}</strong>
            <small>{resumen.datos?.total ?? 0} en total</small>
          </div>
          {rol === ROLES.WASHER && (
            <Tarjeta titulo="Mis lavados en curso">
              {misLavados.length === 0 ? (
                <p className="muted">No tienes lavados asignados en este momento.</p>
              ) : (
                <ul className="lista-simple">
                  {misLavados.map((o) => (
                    <li key={o.id}><span className="placa">{o.placaVehiculo}</span> {o.servicios.join(', ')}</li>
                  ))}
                </ul>
              )}
              <Link to="/panel/lavados" className="btn btn-primary btn-block">Ir a mi cola</Link>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
