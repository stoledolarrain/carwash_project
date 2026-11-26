import { useState } from 'react'
import { comoLista } from '../../api/client'
import { customerApi } from '../../api/services'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Badge, Button, Encabezado, ErrorCaja, EstadoBadge, Field, Modal, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { bs, fecha, iniciales } from '../../utils/format'

const POR_PAGINA = 10

export default function Clientes() {
  const toast = useToast()
  const [consulta, setConsulta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState(null)
  const [nuevo, setNuevo] = useState(false)

  const lista = useApi(
    () => customerApi.buscarClientes({ query: busqueda || undefined, isActive: estado || undefined, page: pagina, pageSize: POR_PAGINA }),
    [busqueda, estado, pagina],
  )
  const clientes = comoLista(lista.datos)
  const total = lista.datos?.total ?? clientes.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <Encabezado titulo="Clientes y vehículos" subtitulo={`${total} cliente(s) registrados`}>
        <Button icon="plus" onClick={() => setNuevo(true)}>Nuevo cliente</Button>
      </Encabezado>

      <Tarjeta>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault()
            setPagina(1)
            setBusqueda(consulta.trim())
          }}
        >
          <div className="search search-block">
            <Icon name="search" size={18} />
            <input placeholder="Nombre, teléfono o correo" value={consulta} onChange={(e) => setConsulta(e.target.value)} aria-label="Buscar cliente" />
          </div>
          <select value={estado} onChange={(e) => { setPagina(1); setEstado(e.target.value) }} aria-label="Estado">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          <Button type="submit" variant="ghost">Buscar</Button>
        </form>

        <ErrorCaja error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando && !lista.datos ? (
          <Spinner />
        ) : clientes.length === 0 ? (
          <Vacio icono="customers" titulo="No hay clientes">{busqueda ? 'Prueba con otra búsqueda.' : 'Registra el primero desde Recepción o con “Nuevo cliente”.'}</Vacio>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Cliente</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th>Registrado</th><th /></tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="fila-click" onClick={() => setDetalle(c)}>
                    <td><span className="persona"><span className="avatar avatar-sm">{iniciales(c.name)}</span>{c.name}</span></td>
                    <td>{c.phone}</td>
                    <td>{c.email || <span className="muted">—</span>}</td>
                    <td>{c.isActive ? <Badge tono="listo">Activo</Badge> : <Badge tono="neutro">Inactivo</Badge>}</td>
                    <td>{fecha(c.createdAt)}</td>
                    <td className="right"><Icon name="arrow" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginas > 1 && (
          <div className="pager">
            <Button size="sm" variant="ghost" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span>Página {pagina} de {paginas}</span>
            <Button size="sm" variant="ghost" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
          </div>
        )}
      </Tarjeta>

      <ClienteFormModal
        abierto={nuevo}
        onCerrar={() => setNuevo(false)}
        onGuardado={(c) => {
          setNuevo(false)
          toast.ok(`Cliente ${c.name} registrado.`)
          lista.recargar()
          setDetalle(c)
        }}
      />
      {detalle && (
        <DetalleCliente
          cliente={detalle}
          onCerrar={() => setDetalle(null)}
          onCambio={(c) => {
            setDetalle(c)
            lista.recargar()
          }}
        />
      )}
    </>
  )
}

function ClienteFormModal({ abierto, cliente, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState({ name: cliente?.name ?? '', phone: cliente?.phone ?? '', email: cliente?.email ?? '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const cuerpo = { name: datos.name.trim(), phone: datos.phone.trim(), email: datos.email.trim() || null }
    try {
      const r = cliente ? await customerApi.actualizarCliente(cliente.id, cuerpo) : await customerApi.registrarCliente(cuerpo)
      if (!cliente) setDatos({ name: '', phone: '', email: '' })
      onGuardado(r)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Nombre completo"><input required value={datos.name} onChange={(e) => setDatos({ ...datos, name: e.target.value })} /></Field>
        <div className="form-grid-2">
          <Field label="Teléfono"><input required inputMode="tel" value={datos.phone} onChange={(e) => setDatos({ ...datos, phone: e.target.value })} /></Field>
          <Field label="Correo"><input type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} placeholder="Opcional" /></Field>
        </div>
        <div className="form-actions">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function DetalleCliente({ cliente, onCerrar, onCambio }) {
  const toast = useToast()
  const [editar, setEditar] = useState(false)
  const [nuevoVehiculo, setNuevoVehiculo] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const vehiculos = useApi(() => customerApi.vehiculosDeCliente(cliente.id), [cliente.id])
  const historial = useApi(() => customerApi.historialDeCliente(cliente.id, { pageSize: 20 }), [cliente.id])

  async function alternarEstado() {
    setCambiando(true)
    try {
      const c = cliente.isActive ? await customerApi.desactivarCliente(cliente.id) : await customerApi.activarCliente(cliente.id)
      toast.ok(c.isActive ? 'Cliente activado.' : 'Cliente desactivado.')
      onCambio(c)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiando(false)
    }
  }

  const items = comoLista(historial.datos)

  return (
    <Modal abierto titulo={cliente.name} onCerrar={onCerrar} ancho={760}>
      <div className="detalle">
        <div className="detalle-datos">
          <span><Icon name="phone" size={16} /> {cliente.phone}</span>
          <span><Icon name="mail" size={16} /> {cliente.email || 'Sin correo'}</span>
          {cliente.isActive ? <Badge tono="listo">Activo</Badge> : <Badge tono="neutro">Inactivo</Badge>}
          <span className="spacer" />
          <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditar(true)}>Editar</Button>
          <Button size="sm" variant={cliente.isActive ? 'danger-ghost' : 'ghost'} icon="power" loading={cambiando} onClick={alternarEstado}>
            {cliente.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>

        <section>
          <div className="section-head">
            <h3>Vehículos</h3>
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setNuevoVehiculo(true)}>Agregar</Button>
          </div>
          {vehiculos.cargando ? <Spinner /> : (
            <div className="chips-vehiculos">
              {comoLista(vehiculos.datos).length === 0 && <p className="muted">Sin vehículos registrados.</p>}
              {comoLista(vehiculos.datos).map((v) => (
                <div key={v.id} className="chip-vehiculo">
                  <span className="placa">{v.plate}</span>
                  <span>{v.brand} {v.model}{v.color ? ` · ${v.color}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3>Historial de lavados</h3>
          <ErrorCaja error={historial.error} />
          {historial.cargando ? <Spinner /> : items.length === 0 ? (
            <p className="muted">Todavía no tiene lavados. El historial se arma con los eventos de Wash Order.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table-compact">
                <thead><tr><th>Fecha</th><th>Placa</th><th>Servicios</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  {items.map((h) => (
                    <tr key={h.orderId}>
                      <td>{fecha(h.createdAt)}</td>
                      <td><span className="placa placa-sm">{h.plate}</span></td>
                      <td>{h.services.join(', ')}</td>
                      <td>{bs(h.totalPrice)}</td>
                      <td><EstadoBadge estado={h.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editar && (
        <ClienteFormModal
          abierto
          cliente={cliente}
          onCerrar={() => setEditar(false)}
          onGuardado={(c) => {
            setEditar(false)
            toast.ok('Datos actualizados.')
            onCambio(c)
          }}
        />
      )}
      {nuevoVehiculo && (
        <VehiculoModal
          clienteId={cliente.id}
          onCerrar={() => setNuevoVehiculo(false)}
          onGuardado={(v) => {
            setNuevoVehiculo(false)
            toast.ok(`Vehículo ${v.plate} agregado.`)
            vehiculos.recargar()
          }}
        />
      )}
    </Modal>
  )
}

function VehiculoModal({ clienteId, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState({ plate: '', brand: '', model: '', color: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      onGuardado(
        await customerApi.registrarVehiculo({
          plate: datos.plate.trim().toUpperCase(),
          brand: datos.brand.trim(),
          model: datos.model.trim(),
          color: datos.color.trim() || null,
          customerId: clienteId,
        }),
      )
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo="Agregar vehículo" onCerrar={onCerrar} ancho={480}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Placa" hint="Entre 5 y 10 caracteres.">
          <input required minLength={5} maxLength={10} value={datos.plate} onChange={(e) => setDatos({ ...datos, plate: e.target.value.toUpperCase() })} />
        </Field>
        <div className="form-grid-3">
          <Field label="Marca"><input required value={datos.brand} onChange={(e) => setDatos({ ...datos, brand: e.target.value })} /></Field>
          <Field label="Modelo"><input required value={datos.model} onChange={(e) => setDatos({ ...datos, model: e.target.value })} /></Field>
          <Field label="Color"><input value={datos.color} onChange={(e) => setDatos({ ...datos, color: e.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Agregar</Button>
        </div>
      </form>
    </Modal>
  )
}
