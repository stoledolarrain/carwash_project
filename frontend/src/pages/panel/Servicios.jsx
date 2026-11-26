import { useState } from 'react'
import { comoLista } from '../../api/client'
import { catalogApi } from '../../api/services'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Badge, Button, Encabezado, ErrorCaja, Field, Modal, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { useApi } from '../../hooks/useApi'
import { bs, fecha } from '../../utils/format'

export default function Servicios() {
  const toast = useToast()
  const [estado, setEstado] = useState('')
  const lista = useApi(() => catalogApi.listarAdmin({ isActive: estado || undefined }), [estado])
  const [editando, setEditando] = useState(null) // null | {} (nuevo) | servicio
  const [precio, setPrecio] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const servicios = comoLista(lista.datos)

  async function alternar(s) {
    setOcupado(s.id)
    try {
      await (s.isActive ? catalogApi.desactivar(s.id) : catalogApi.activar(s.id))
      toast.ok(s.isActive ? `${s.name} ya no se ofrece.` : `${s.name} vuelve a estar disponible.`)
      lista.recargar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <Encabezado titulo="Catálogo de servicios" subtitulo="Lo que se ofrece en recepción y en la página pública.">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <Button icon="plus" onClick={() => setEditando({})}>Nuevo servicio</Button>
      </Encabezado>

      <ErrorCaja error={lista.error} onReintentar={lista.recargar} />
      {lista.cargando && !lista.datos ? (
        <Spinner />
      ) : servicios.length === 0 ? (
        <Tarjeta><Vacio icono="services" titulo="No hay servicios">Crea el primer servicio del catálogo.</Vacio></Tarjeta>
      ) : (
        <div className="admin-servicios">
          {servicios.map((s) => (
            <article key={s.id} className={`admin-servicio ${s.isActive ? '' : 'inactivo'}`}>
              <header>
                <h3>{s.name}</h3>
                {s.isActive ? <Badge tono="listo">Activo</Badge> : <Badge tono="neutro">Inactivo</Badge>}
              </header>
              <p>{s.description || <span className="muted">Sin descripción</span>}</p>
              <div className="admin-servicio-datos">
                <strong>{bs(s.price)}</strong>
                <span><Icon name="clock" size={16} /> {s.estimatedDuration} min</span>
              </div>
              <small className="muted">Versión {s.version} · actualizado {fecha(s.updatedAt)}</small>
              <footer>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditando(s)}>Editar</Button>
                <Button size="sm" variant="ghost" icon="payments" onClick={() => setPrecio(s)}>Precio</Button>
                <Button size="sm" variant={s.isActive ? 'danger-ghost' : 'ghost'} icon="power" loading={ocupado === s.id} onClick={() => alternar(s)}>
                  {s.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {editando && (
        <ServicioModal
          servicio={editando.id ? editando : null}
          onCerrar={() => setEditando(null)}
          onGuardado={(s, nuevo) => {
            setEditando(null)
            toast.ok(nuevo ? `Servicio ${s.name} creado.` : 'Servicio actualizado.')
            lista.recargar()
          }}
        />
      )}
      {precio && (
        <PrecioModal
          servicio={precio}
          onCerrar={() => setPrecio(null)}
          onGuardado={(s) => {
            setPrecio(null)
            toast.ok(`Nuevo precio de ${s.name}: ${bs(s.price)}.`)
            lista.recargar()
          }}
        />
      )}
    </>
  )
}

function ServicioModal({ servicio, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState({
    name: servicio?.name ?? '',
    description: servicio?.description ?? '',
    price: '',
    estimatedDuration: servicio?.estimatedDuration ?? 30,
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const base = { name: datos.name.trim(), description: datos.description.trim(), estimatedDuration: Number(datos.estimatedDuration) }
    try {
      const r = servicio
        ? await catalogApi.actualizar(servicio.id, base)
        : await catalogApi.crear({ ...base, price: Number(datos.price) })
      onGuardado(r, !servicio)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo={servicio ? `Editar ${servicio.name}` : 'Nuevo servicio'} onCerrar={onCerrar}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Nombre"><input required value={datos.name} onChange={(e) => setDatos({ ...datos, name: e.target.value })} placeholder="Lavado completo" /></Field>
        <Field label="Descripción"><textarea rows={3} value={datos.description} onChange={(e) => setDatos({ ...datos, description: e.target.value })} /></Field>
        <div className="form-grid-2">
          {!servicio && (
            <Field label="Precio (Bs)"><input required type="number" min="0" step="0.01" value={datos.price} onChange={(e) => setDatos({ ...datos, price: e.target.value })} /></Field>
          )}
          <Field label="Duración (min)"><input required type="number" min="1" step="1" value={datos.estimatedDuration} onChange={(e) => setDatos({ ...datos, estimatedDuration: e.target.value })} /></Field>
        </div>
        {servicio && <p className="field-hint">El precio se cambia aparte con “Precio”: Catalog publica el evento ServicePriceChanged.</p>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}

function PrecioModal({ servicio, onCerrar, onGuardado }) {
  const [valor, setValor] = useState(String(servicio.price))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      onGuardado(await catalogApi.cambiarPrecio(servicio.id, Number(valor)))
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo={`Precio de ${servicio.name}`} onCerrar={onCerrar} ancho={400}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <p className="muted">Precio actual: <strong>{bs(servicio.price)}</strong>. Las órdenes ya creadas conservan su precio.</p>
        <Field label="Nuevo precio (Bs)"><input required autoFocus type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <div className="form-actions">
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Cambiar precio</Button>
        </div>
      </form>
    </Modal>
  )
}
