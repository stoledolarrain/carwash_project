import { useState } from 'react'
import { comoLista } from '../../api/client'
import { identityApi } from '../../api/services'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { Badge, Button, Encabezado, ErrorCaja, Field, Modal, Spinner, Tarjeta, Vacio } from '../../components/ui'
import { NOMBRE_ROL, ROLES } from '../../config/navigation'
import { useApi } from '../../hooks/useApi'
import { fecha, iniciales } from '../../utils/format'

const POR_PAGINA = 20
const TONO_ROL = { ADMIN: 'pago', RECEPTIONIST: 'proceso', WASHER: 'listo' }

export default function Usuarios() {
  const { usuario: yo } = useAuth()
  const toast = useToast()
  const [consulta, setConsulta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState(null) // { tipo: 'nuevo' | 'rol' | 'clave' | 'nombre', usuario }
  const [ocupado, setOcupado] = useState(null)

  const lista = useApi(
    () => identityApi.listarUsuarios({ search: busqueda || undefined, role: rol || undefined, page: pagina, pageSize: POR_PAGINA }),
    [busqueda, rol, pagina],
  )
  const usuarios = comoLista(lista.datos)
  const total = lista.datos?.total ?? usuarios.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  async function alternar(u) {
    setOcupado(u.id)
    try {
      await (u.isActive ? identityApi.desactivar(u.id) : identityApi.activar(u.id))
      toast.ok(u.isActive ? `${u.fullName} ya no puede ingresar.` : `${u.fullName} puede volver a ingresar.`)
      lista.recargar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOcupado(null)
    }
  }

  const listo = (mensaje) => {
    setModal(null)
    toast.ok(mensaje)
    lista.recargar()
  }

  return (
    <>
      <Encabezado titulo="Usuarios y personal" subtitulo="Solo el administrador crea cuentas: no hay registro público.">
        <Button icon="plus" onClick={() => setModal({ tipo: 'nuevo' })}>Nuevo usuario</Button>
      </Encabezado>

      <Tarjeta>
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setPagina(1); setBusqueda(consulta.trim()) }}>
          <div className="search search-block">
            <Icon name="search" size={18} />
            <input placeholder="Nombre o correo" value={consulta} onChange={(e) => setConsulta(e.target.value)} aria-label="Buscar usuario" />
          </div>
          <select value={rol} onChange={(e) => { setPagina(1); setRol(e.target.value) }} aria-label="Rol">
            <option value="">Todos los roles</option>
            {Object.values(ROLES).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
          </select>
          <Button type="submit" variant="ghost">Buscar</Button>
        </form>

        <ErrorCaja error={lista.error} onReintentar={lista.recargar} />
        {lista.cargando && !lista.datos ? (
          <Spinner />
        ) : usuarios.length === 0 ? (
          <Vacio icono="users" titulo="No hay usuarios con ese filtro" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th className="right">Acciones</th></tr></thead>
              <tbody>
                {usuarios.map((u) => {
                  const soyYo = u.id === yo?.id
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="persona">
                          <span className="avatar avatar-sm">{iniciales(u.fullName)}</span>
                          <span><strong>{u.fullName}{soyYo && ' (tú)'}</strong><small className="block muted">{u.email}</small></span>
                        </span>
                      </td>
                      <td><Badge tono={TONO_ROL[u.role]}>{NOMBRE_ROL[u.role] ?? u.role}</Badge></td>
                      <td>{u.isActive ? <Badge tono="listo">Activo</Badge> : <Badge tono="neutro">Inactivo</Badge>}</td>
                      <td>{u.lastLoginAt ? fecha(u.lastLoginAt) : <span className="muted">Nunca</span>}</td>
                      <td className="right">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Editar nombre" aria-label="Editar nombre" onClick={() => setModal({ tipo: 'nombre', usuario: u })}><Icon name="edit" size={18} /></button>
                          {!soyYo && <button type="button" className="icon-btn" title="Cambiar rol" aria-label="Cambiar rol" onClick={() => setModal({ tipo: 'rol', usuario: u })}><Icon name="shield" size={18} /></button>}
                          {!soyYo && <button type="button" className="icon-btn" title="Restablecer contraseña" aria-label="Restablecer contraseña" onClick={() => setModal({ tipo: 'clave', usuario: u })}><Icon name="key" size={18} /></button>}
                          {!soyYo && (
                            <Button size="sm" variant={u.isActive ? 'danger-ghost' : 'ghost'} loading={ocupado === u.id} onClick={() => alternar(u)}>
                              {u.isActive ? 'Desactivar' : 'Activar'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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

      {modal?.tipo === 'nuevo' && <NuevoUsuarioModal onCerrar={() => setModal(null)} onListo={(u) => listo(`Cuenta de ${u.fullName} creada.`)} />}
      {modal?.tipo === 'rol' && <RolModal usuario={modal.usuario} onCerrar={() => setModal(null)} onListo={(u) => listo(`${u.fullName} ahora es ${NOMBRE_ROL[u.role]}.`)} />}
      {modal?.tipo === 'clave' && <ClaveModal usuario={modal.usuario} onCerrar={() => setModal(null)} onListo={() => listo('Contraseña restablecida. Sus sesiones abiertas se cerraron.')} />}
      {modal?.tipo === 'nombre' && <NombreModal usuario={modal.usuario} onCerrar={() => setModal(null)} onListo={() => listo('Nombre actualizado.')} />}
    </>
  )
}

/** Formulario genérico de un modal: maneja envío, error y estado de carga. */
function useEnvio(accion, onListo) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      onListo(await accion())
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }
  return { enviar, enviando, error }
}

function Acciones({ onCerrar, enviando, texto = 'Guardar' }) {
  return (
    <div className="form-actions">
      <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
      <Button type="submit" loading={enviando}>{texto}</Button>
    </div>
  )
}

function NuevoUsuarioModal({ onCerrar, onListo }) {
  const [d, setD] = useState({ fullName: '', email: '', password: '', role: ROLES.RECEPTIONIST })
  const { enviar, enviando, error } = useEnvio(
    () => identityApi.crearUsuario({ ...d, fullName: d.fullName.trim(), email: d.email.trim() }),
    onListo,
  )
  return (
    <Modal abierto titulo="Nuevo usuario" onCerrar={onCerrar}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Nombre completo"><input required minLength={3} value={d.fullName} onChange={(e) => setD({ ...d, fullName: e.target.value })} /></Field>
        <Field label="Correo"><input required type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></Field>
        <div className="form-grid-2">
          <Field label="Contraseña inicial" hint="Mínimo 8 caracteres, con letras y números.">
            <input required type="password" autoComplete="new-password" minLength={8} value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} />
          </Field>
          <Field label="Rol">
            <select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })}>
              {Object.values(ROLES).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
            </select>
          </Field>
        </div>
        <Acciones onCerrar={onCerrar} enviando={enviando} texto="Crear cuenta" />
      </form>
    </Modal>
  )
}

function RolModal({ usuario, onCerrar, onListo }) {
  const [rol, setRol] = useState(usuario.role)
  const { enviar, enviando, error } = useEnvio(() => identityApi.cambiarRol(usuario.id, rol), onListo)
  return (
    <Modal abierto titulo={`Rol de ${usuario.fullName}`} onCerrar={onCerrar} ancho={420}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <div className="roles-opciones">
          {Object.values(ROLES).map((r) => (
            <label key={r} className={`rol-opcion ${rol === r ? 'activo' : ''}`}>
              <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} />
              <strong>{NOMBRE_ROL[r]}</strong>
            </label>
          ))}
        </div>
        <p className="field-hint">Al cambiar el rol, Identity invalida las sesiones abiertas de este usuario.</p>
        <Acciones onCerrar={onCerrar} enviando={enviando} />
      </form>
    </Modal>
  )
}

function ClaveModal({ usuario, onCerrar, onListo }) {
  const [clave, setClave] = useState('')
  const { enviar, enviando, error } = useEnvio(() => identityApi.restablecerPassword(usuario.id, clave), onListo)
  return (
    <Modal abierto titulo={`Restablecer contraseña de ${usuario.fullName}`} onCerrar={onCerrar} ancho={440}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Nueva contraseña" hint="Comunícasela al usuario en persona.">
          <input required type="password" autoComplete="new-password" minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} />
        </Field>
        <Acciones onCerrar={onCerrar} enviando={enviando} texto="Restablecer" />
      </form>
    </Modal>
  )
}

function NombreModal({ usuario, onCerrar, onListo }) {
  const { usuario: yo, actualizarUsuario } = useAuth()
  const [nombre, setNombre] = useState(usuario.fullName)
  const { enviar, enviando, error } = useEnvio(async () => {
    const u = await identityApi.actualizarNombre(usuario.id, nombre.trim())
    if (u.id === yo?.id) actualizarUsuario(u)
    return u
  }, onListo)
  return (
    <Modal abierto titulo="Editar nombre" onCerrar={onCerrar} ancho={420}>
      <form className="form" onSubmit={enviar}>
        <ErrorCaja error={error} />
        <Field label="Nombre completo"><input required minLength={3} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Acciones onCerrar={onCerrar} enviando={enviando} />
      </form>
    </Modal>
  )
}
