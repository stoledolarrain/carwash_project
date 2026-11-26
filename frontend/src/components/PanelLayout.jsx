import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NOMBRE_ROL, pantallasDelRol } from '../config/navigation'
import { iniciales } from '../utils/format'
import Icon from './Icon'
import Logo from './Logo'
import CambiarPasswordModal from './CambiarPasswordModal'

export default function PanelLayout() {
  const { usuario, rol, cerrarSesion } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cambiarClave, setCambiarClave] = useState(false)
  const { pathname } = useLocation()
  const pantallas = pantallasDelRol(rol)
  const actual = pantallas.find((p) => p.ruta === pathname)

  return (
    <div className={`shell ${menuAbierto ? 'shell-menu' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Logo claro />
          <button type="button" className="icon-btn sidebar-close" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <Icon name="x" />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Menú del panel">
          {pantallas.map((p) => (
            <NavLink key={p.ruta} to={p.ruta} end onClick={() => setMenuAbierto(false)} className="nav-item">
              <Icon name={p.icono} />
              <span>{p.titulo}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/" className="nav-item">
            <Icon name="map" />
            <span>Ver sitio público</span>
          </NavLink>
        </div>
      </aside>
      <button type="button" className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <span className="topbar-title">{actual?.titulo ?? 'Panel'}</span>
          <div className="topbar-user">
            <span className="avatar">{iniciales(usuario?.fullName)}</span>
            <span className="topbar-user-text">
              <strong>{usuario?.fullName}</strong>
              <small>{NOMBRE_ROL[rol] ?? rol}</small>
            </span>
            <button type="button" className="icon-btn" title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña" onClick={() => setCambiarClave(true)}>
              <Icon name="key" />
            </button>
            <button type="button" className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => cerrarSesion()}>
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <CambiarPasswordModal abierto={cambiarClave} onCerrar={() => setCambiarClave(false)} />
    </div>
  )
}
