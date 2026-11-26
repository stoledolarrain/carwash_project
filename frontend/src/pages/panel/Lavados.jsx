import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { comoLista } from '../../api/client'
import { ordersApi } from '../../api/services'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Button, Encabezado, ErrorCaja, Field, Modal, Spinner } from '../../components/ui'
import { ESTADOS_ORDEN, ROLES } from '../../config/navigation'
import { useApi } from '../../hooks/useApi'
import { usePersonal } from '../../hooks/usePersonal'
import { bs, esHoy, haceCuanto, idCorto } from '../../utils/format'

const COLUMNAS = ['EN_ESPERA', 'EN_PROCESO', 'LISTO', 'ENTREGADO']

export default function Lavados() {
  const { usuario, rol } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const personal = usePersonal()
  const ordenes = useApi(() => ordersApi.listar(), [], { intervaloMs: 10000 })
  const [filtro, setFiltro] = useState('')
  const [soloMias, setSoloMias] = useState(rol === ROLES.WASHER)
  const [ocupada, setOcupada] = useState(null)
  const [asignando, setAsignando] = useState(null)

  const opera = rol === ROLES.ADMIN || rol === ROLES.RECEPTIONIST

  const porEstado = useMemo(() => {
    const q = filtro.trim().toUpperCase()
    const lista = comoLista(ordenes.datos).filter((o) => {
      if (q && !o.placaVehiculo.includes(q)) return false
      if (soloMias && o.estado !== 'EN_ESPERA' && o.responsableId !== usuario?.id) return false
      // La columna de entregados muestra solo los de hoy para que la cola no crezca sin fin.
      if (o.estado === 'ENTREGADO' && !esHoy(o.fechaEntrega || o.fechaCreacion)) return false
      return true
    })
    const grupos = Object.fromEntries(COLUMNAS.map((c) => [c, []]))
    for (const o of lista) grupos[o.estado]?.push(o)
    // Los que esperan, del más antiguo al más nuevo (orden de llegada).
    grupos.EN_ESPERA.reverse()
    return grupos
  }, [ordenes.datos, filtro, soloMias, usuario])

  async function accion(orden, tipo, responsableId) {
    setOcupada(orden.id)
    try {
      if (tipo === 'iniciar') await ordersApi.iniciar(orden.id, responsableId)
      if (tipo === 'completar') await ordersApi.completar(orden.id)
      if (tipo === 'entregar') await ordersApi.entregar(orden.id)
      const mensajes = {
        iniciar: `Lavado de ${orden.placaVehiculo} iniciado.`,
        completar: `${orden.placaVehiculo} está listo. Se avisó al cliente.`,
        entregar: `${orden.placaVehiculo} entregado.`,
      }
      toast.ok(mensajes[tipo])
      setAsignando(null)
      ordenes.recargar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOcupada(null)
    }
  }

  return (
    <>
      <Encabezado titulo="Cola de lavados" subtitulo="Se actualiza sola cada 10 segundos.">
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Buscar placa" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar por placa" />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />
          <span>Solo mis lavados</span>
        </label>
        <Button variant="ghost" icon="refresh" onClick={ordenes.recargar} aria-label="Actualizar" />
      </Encabezado>

      <ErrorCaja error={ordenes.error} onReintentar={ordenes.recargar} />
      {ordenes.cargando && !ordenes.datos && <Spinner />}

      <div className="kanban">
        {COLUMNAS.map((estado) => (
          <section key={estado} className={`kanban-col col-${ESTADOS_ORDEN[estado].tono}`}>
            <header>
              <h2>{ESTADOS_ORDEN[estado].etiqueta}</h2>
              <span className="count">{porEstado[estado].length}</span>
            </header>
            <div className="kanban-list">
              {porEstado[estado].length === 0 && <p className="kanban-empty">Sin vehículos</p>}
              {porEstado[estado].map((o) => (
                <article key={o.id} className={`orden ${o.responsableId === usuario?.id ? 'orden-mia' : ''}`}>
                  <div className="orden-top">
                    <span className="placa">{o.placaVehiculo}</span>
                    <span className="orden-id">#{idCorto(o.id)}</span>
                  </div>
                  <ul className="orden-servicios">
                    {o.servicios.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                  <div className="orden-meta">
                    <span><Icon name="clock" size={14} /> {haceCuanto(o.fechaCreacion)}</span>
                    <strong>{bs(o.precioTotal)}</strong>
                  </div>
                  {o.responsableId && (
                    <div className="orden-resp"><Icon name="users" size={14} /> {personal.nombre(o.responsableId)}</div>
                  )}
                  <div className="orden-acciones">
                    {estado === 'EN_ESPERA' && opera && (
                      <Button size="sm" icon="play" onClick={() => setAsignando(o)}>Iniciar</Button>
                    )}
                    {estado === 'EN_ESPERA' && rol === ROLES.WASHER && (
                      <small className="muted">Recepción asigna este lavado.</small>
                    )}
                    {estado === 'EN_PROCESO' && (
                      <Button size="sm" variant="success" icon="check" loading={ocupada === o.id} onClick={() => accion(o, 'completar')}>
                        Terminar
                      </Button>
                    )}
                    {estado === 'LISTO' && opera && (
                      <>
                        <Button size="sm" icon="handover" loading={ocupada === o.id} onClick={() => accion(o, 'entregar')}>Entregar</Button>
                        <Button size="sm" variant="ghost" icon="payments" onClick={() => navigate(`/panel/pagos?orden=${o.id}`)}>Cobrar</Button>
                      </>
                    )}
                    {estado === 'ENTREGADO' && opera && (
                      <Button size="sm" variant="ghost" icon="payments" onClick={() => navigate(`/panel/pagos?orden=${o.id}`)}>Pago</Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <AsignarModal
        orden={asignando}
        personal={personal}
        usuario={usuario}
        enviando={Boolean(asignando && ocupada === asignando.id)}
        onCerrar={() => setAsignando(null)}
        onConfirmar={(responsableId) => accion(asignando, 'iniciar', responsableId)}
      />
    </>
  )
}

function AsignarModal({ orden, personal, usuario, enviando, onCerrar, onConfirmar }) {
  const [responsable, setResponsable] = useState('')

  const cerrar = () => {
    setResponsable('')
    onCerrar()
  }

  return (
    <Modal abierto={Boolean(orden)} titulo={`Iniciar lavado · ${orden?.placaVehiculo ?? ''}`} onCerrar={cerrar} ancho={460}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          onConfirmar(responsable.trim())
          setResponsable('')
        }}
      >
        <p className="muted">Elige quién se encarga de este vehículo. El cliente recibirá un aviso de que su lavado comenzó.</p>
        {personal.puedeListar ? (
          <Field label="Responsable">
            <select required value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Selecciona al personal…</option>
              {personal.lavadores.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
              <option value={usuario.id}>{usuario.fullName} (yo)</option>
            </select>
          </Field>
        ) : (
          <Field label="Responsable" hint="Nombre de la persona del equipo de lavado.">
            <input required minLength={2} value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Ej.: Carlos" />
          </Field>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          <Button type="submit" icon="play" loading={enviando}>Iniciar lavado</Button>
        </div>
      </form>
    </Modal>
  )
}
