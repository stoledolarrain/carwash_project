import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { comoLista } from '../../api/client'
import { catalogApi, customerApi, ordersApi } from '../../api/services'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Badge, Button, Encabezado, ErrorCaja, EstadoBadge, Field, Spinner, Tarjeta } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { bs, fecha, idCorto } from '../../utils/format'

const CLIENTE_VACIO = { name: '', phone: '', email: '' }
const VEHICULO_VACIO = { brand: '', model: '', color: '' }

/**
 * Flujo de recepción en tres pasos:
 * 1) placa → Customer busca el vehículo (y su dueño); si no existe se registra.
 * 2) servicios → Catalog da precios y tiempos oficiales.
 * 3) orden → Wash Order la crea en EN_ESPERA y publica WashOrderCreated.
 */
export default function Recepcion() {
  const toast = useToast()
  const catalogo = useApi(() => catalogApi.serviciosActivos(), [])
  const servicios = useMemo(() => comoLista(catalogo.datos), [catalogo.datos])

  const [placa, setPlaca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [busqueda, setBusqueda] = useState(null) // { placa, vehiculo, cliente, visitas }
  const [error, setError] = useState(null)

  const [vehiculoNuevo, setVehiculoNuevo] = useState(VEHICULO_VACIO)
  const [modoCliente, setModoCliente] = useState('nuevo') // nuevo | existente | ninguno
  const [clienteNuevo, setClienteNuevo] = useState(CLIENTE_VACIO)
  const [consultaCliente, setConsultaCliente] = useState('')
  const [coincidencias, setCoincidencias] = useState([])
  const [clienteElegido, setClienteElegido] = useState(null)
  const [registrando, setRegistrando] = useState(false)

  const [elegidos, setElegidos] = useState([])
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState(null)

  const seleccion = servicios.filter((s) => elegidos.includes(s.id))
  const total = seleccion.reduce((t, s) => t + Number(s.price), 0)
  const minutos = seleccion.reduce((t, s) => t + Number(s.estimatedDuration || 0), 0)
  const vehiculoListo = Boolean(busqueda?.vehiculo)

  function reiniciar() {
    setPlaca('')
    setBusqueda(null)
    setError(null)
    setVehiculoNuevo(VEHICULO_VACIO)
    setClienteNuevo(CLIENTE_VACIO)
    setClienteElegido(null)
    setCoincidencias([])
    setConsultaCliente('')
    setModoCliente('nuevo')
    setElegidos([])
    setCreada(null)
  }

  async function buscarPlaca(e) {
    e.preventDefault()
    const p = placa.trim().toUpperCase()
    if (p.length < 5 || p.length > 10) {
      setError({ message: 'La placa debe tener entre 5 y 10 caracteres.' })
      return
    }
    setBuscando(true)
    setError(null)
    setCreada(null)
    try {
      const [vehiculo, visitas] = await Promise.all([
        customerApi.vehiculoPorPlaca(p).catch((err) => {
          if (err.status === 404) return null
          throw err
        }),
        ordersApi.porPlaca(p).catch(() => []),
      ])
      const cliente = vehiculo?.customerId ? await customerApi.obtenerCliente(vehiculo.customerId).catch(() => null) : null
      setBusqueda({ placa: p, vehiculo, cliente, visitas: comoLista(visitas) })
    } catch (err) {
      setError(err)
    } finally {
      setBuscando(false)
    }
  }

  async function buscarClientes() {
    const q = consultaCliente.trim()
    if (!q) return
    try {
      const r = await customerApi.buscarClientes({ query: q, isActive: true, pageSize: 8 })
      setCoincidencias(comoLista(r))
      if (comoLista(r).length === 0) toast.error('No se encontraron clientes con ese dato.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function registrarVehiculo(e) {
    e.preventDefault()
    setRegistrando(true)
    setError(null)
    try {
      let cliente = null
      if (modoCliente === 'nuevo') {
        cliente = await customerApi.registrarCliente({
          name: clienteNuevo.name.trim(),
          phone: clienteNuevo.phone.trim(),
          email: clienteNuevo.email.trim() || null,
        })
        // Si luego falla el registro del vehículo, el reintento usa este cliente en vez de crear otro.
        setClienteElegido(cliente)
        setCoincidencias([cliente])
        setModoCliente('existente')
      } else if (modoCliente === 'existente') {
        if (!clienteElegido) throw new Error('Selecciona un cliente de la lista.')
        cliente = clienteElegido
      }
      const vehiculo = await customerApi.registrarVehiculo({
        plate: busqueda.placa,
        brand: vehiculoNuevo.brand.trim(),
        model: vehiculoNuevo.model.trim(),
        color: vehiculoNuevo.color.trim() || null,
        customerId: cliente?.id ?? null,
      })
      setBusqueda((b) => ({ ...b, vehiculo, cliente }))
      toast.ok(`Vehículo ${vehiculo.plate} registrado.`)
    } catch (err) {
      setError(err)
    } finally {
      setRegistrando(false)
    }
  }

  async function asignarDueno() {
    if (!clienteElegido) return
    try {
      const vehiculo = await customerApi.cambiarPropietario(busqueda.vehiculo.id, clienteElegido.id)
      setBusqueda((b) => ({ ...b, vehiculo, cliente: clienteElegido }))
      toast.ok('Propietario asignado.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function crearOrden() {
    setCreando(true)
    setError(null)
    try {
      const orden = await ordersApi.crear({
        placaVehiculo: busqueda.placa,
        clienteId: busqueda.cliente?.id ?? null,
        servicios: seleccion.map((s) => s.name),
        // Wash Order aún no consulta precios en Catalog: el total se calcula con los precios oficiales del catálogo.
        precioTotal: Math.round(total * 100) / 100,
      })
      setCreada(orden)
      toast.ok(`Orden creada para ${orden.placaVehiculo}.`)
    } catch (err) {
      setError(err)
    } finally {
      setCreando(false)
    }
  }

  const alternar = (id) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))

  if (creada) {
    return (
      <>
        <Encabezado titulo="Recepción" />
        <div className="exito">
          <span className="exito-icon"><Icon name="check" size={34} strokeWidth={2.4} /></span>
          <h2>Orden #{idCorto(creada.id)} creada</h2>
          <p>
            <span className="placa">{creada.placaVehiculo}</span> quedó en la cola en espera, por {bs(creada.precioTotal)}.
            {busqueda?.cliente && <> Se avisará a {busqueda.cliente.name}.</>}
          </p>
          <ul className="exito-servicios">{creada.servicios.map((s) => <li key={s}>{s}</li>)}</ul>
          <div className="form-actions center">
            <Link to="/panel/lavados" className="btn btn-ghost">Ver cola de lavados</Link>
            <Button icon="plus" onClick={reiniciar}>Recibir otro vehículo</Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Encabezado titulo="Recepción" subtitulo="Registra el vehículo, elige los servicios y crea la orden.">
        {busqueda && <Button variant="ghost" icon="refresh" onClick={reiniciar}>Empezar de nuevo</Button>}
      </Encabezado>
      <ErrorCaja error={error} />

      <div className="recepcion">
        <div className="stack">
          {/* Paso 1 */}
          <Tarjeta titulo={<><span className="paso-chip">1</span> Vehículo</>}>
            <form className="placa-form" onSubmit={buscarPlaca}>
              <input
                className="placa-input"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="1234-ABC"
                maxLength={10}
                aria-label="Placa del vehículo"
                disabled={vehiculoListo}
              />
              {!vehiculoListo && <Button type="submit" icon="search" loading={buscando}>Buscar</Button>}
            </form>

            {busqueda?.vehiculo && (
              <div className="vehiculo-ficha">
                <Icon name="car" size={30} />
                <div>
                  <strong>{busqueda.vehiculo.brand} {busqueda.vehiculo.model}</strong>
                  <small>{busqueda.vehiculo.color || 'Color no registrado'} · {busqueda.visitas.length} visita(s) anteriores</small>
                </div>
                {busqueda.cliente ? (
                  <div className="vehiculo-dueno">
                    <span>{busqueda.cliente.name}</span>
                    <small>{busqueda.cliente.phone}</small>
                  </div>
                ) : (
                  <Badge tono="espera">Sin propietario</Badge>
                )}
              </div>
            )}

            {busqueda?.vehiculo && !busqueda.cliente && (
              <BuscarCliente
                consulta={consultaCliente}
                setConsulta={setConsultaCliente}
                onBuscar={buscarClientes}
                coincidencias={coincidencias}
                elegido={clienteElegido}
                setElegido={setClienteElegido}
                accion={<Button size="sm" disabled={!clienteElegido} onClick={asignarDueno}>Asignar propietario</Button>}
              />
            )}

            {busqueda && !busqueda.vehiculo && (
              <form className="form" onSubmit={registrarVehiculo}>
                <div className="alert alert-info">
                  La placa <strong>{busqueda.placa}</strong> es nueva. Regístrala para continuar.
                </div>
                <div className="form-grid-3">
                  <Field label="Marca"><input required value={vehiculoNuevo.brand} onChange={(e) => setVehiculoNuevo({ ...vehiculoNuevo, brand: e.target.value })} placeholder="Toyota" /></Field>
                  <Field label="Modelo"><input required value={vehiculoNuevo.model} onChange={(e) => setVehiculoNuevo({ ...vehiculoNuevo, model: e.target.value })} placeholder="Corolla" /></Field>
                  <Field label="Color"><input value={vehiculoNuevo.color} onChange={(e) => setVehiculoNuevo({ ...vehiculoNuevo, color: e.target.value })} placeholder="Opcional" /></Field>
                </div>

                <div className="segmented" role="radiogroup" aria-label="Propietario">
                  {[['nuevo', 'Cliente nuevo'], ['existente', 'Cliente existente'], ['ninguno', 'Sin cliente']].map(([v, t]) => (
                    <button key={v} type="button" role="radio" aria-checked={modoCliente === v} className={modoCliente === v ? 'activo' : ''} onClick={() => setModoCliente(v)}>{t}</button>
                  ))}
                </div>

                {modoCliente === 'nuevo' && (
                  <div className="form-grid-3">
                    <Field label="Nombre completo"><input required value={clienteNuevo.name} onChange={(e) => setClienteNuevo({ ...clienteNuevo, name: e.target.value })} /></Field>
                    <Field label="Teléfono" hint="Para los avisos."><input required inputMode="tel" value={clienteNuevo.phone} onChange={(e) => setClienteNuevo({ ...clienteNuevo, phone: e.target.value })} placeholder="70012345" /></Field>
                    <Field label="Correo"><input type="email" value={clienteNuevo.email} onChange={(e) => setClienteNuevo({ ...clienteNuevo, email: e.target.value })} placeholder="Opcional" /></Field>
                  </div>
                )}
                {modoCliente === 'existente' && (
                  <BuscarCliente
                    consulta={consultaCliente}
                    setConsulta={setConsultaCliente}
                    onBuscar={buscarClientes}
                    coincidencias={coincidencias}
                    elegido={clienteElegido}
                    setElegido={setClienteElegido}
                  />
                )}
                <div className="form-actions">
                  <Button type="submit" loading={registrando} icon="check">Registrar vehículo</Button>
                </div>
              </form>
            )}
          </Tarjeta>

          {/* Paso 2 */}
          <Tarjeta titulo={<><span className="paso-chip">2</span> Servicios</>} className={vehiculoListo ? '' : 'bloqueado'}>
            {catalogo.cargando ? (
              <Spinner texto="Cargando catálogo…" />
            ) : (
              <>
                <ErrorCaja error={catalogo.error} onReintentar={catalogo.recargar} />
                <div className="servicio-picker">
                  {servicios.map((s) => (
                    <label key={s.id} className={`servicio-opcion ${elegidos.includes(s.id) ? 'activo' : ''}`}>
                      <input type="checkbox" checked={elegidos.includes(s.id)} onChange={() => alternar(s.id)} disabled={!vehiculoListo} />
                      <span className="servicio-opcion-check"><Icon name="check" size={16} strokeWidth={2.6} /></span>
                      <span className="servicio-opcion-text">
                        <strong>{s.name}</strong>
                        <small>{s.estimatedDuration} min</small>
                      </span>
                      <span className="servicio-opcion-precio">{bs(s.price)}</span>
                    </label>
                  ))}
                  {servicios.length === 0 && !catalogo.error && <p className="muted">No hay servicios activos en el catálogo.</p>}
                </div>
              </>
            )}
          </Tarjeta>
        </div>

        {/* Paso 3 */}
        <aside className="ticket">
          <h2><span className="paso-chip">3</span> Orden</h2>
          <dl>
            <div><dt>Placa</dt><dd>{busqueda?.placa ?? '—'}</dd></div>
            <div><dt>Cliente</dt><dd>{busqueda?.cliente?.name ?? (vehiculoListo ? 'Sin cliente' : '—')}</dd></div>
          </dl>
          <ul className="ticket-items">
            {seleccion.length === 0 && <li className="muted">Elige al menos un servicio.</li>}
            {seleccion.map((s) => (
              <li key={s.id}><span>{s.name}</span><span>{bs(s.price)}</span></li>
            ))}
          </ul>
          <div className="ticket-total">
            <span>Total</span>
            <strong>{bs(total)}</strong>
          </div>
          <p className="ticket-tiempo"><Icon name="clock" size={16} /> Tiempo estimado: {minutos} min</p>
          <Button size="lg" className="btn-block" icon="check" disabled={!vehiculoListo || seleccion.length === 0} loading={creando} onClick={crearOrden}>
            Crear orden
          </Button>

          {busqueda?.visitas?.length > 0 && (
            <div className="ticket-visitas">
              <h3>Visitas anteriores</h3>
              <ul>
                {busqueda.visitas.slice(0, 4).map((v) => (
                  <li key={v.id}>
                    <span>{fecha(v.fechaCreacion)}</span>
                    <EstadoBadge estado={v.estado} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function BuscarCliente({ consulta, setConsulta, onBuscar, coincidencias, elegido, setElegido, accion }) {
  return (
    <div className="buscar-cliente">
      <div className="search search-block">
        <Icon name="search" size={18} />
        <input
          placeholder="Buscar cliente por nombre o teléfono"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onBuscar()
            }
          }}
        />
        <Button size="sm" variant="ghost" onClick={onBuscar}>Buscar</Button>
      </div>
      {coincidencias.length > 0 && (
        <ul className="coincidencias">
          {coincidencias.map((c) => (
            <li key={c.id}>
              <button type="button" className={elegido?.id === c.id ? 'activo' : ''} onClick={() => setElegido(c)}>
                <strong>{c.name}</strong>
                <small>{c.phone}{c.email ? ` · ${c.email}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {accion && <div className="form-actions">{accion}</div>}
    </div>
  )
}
