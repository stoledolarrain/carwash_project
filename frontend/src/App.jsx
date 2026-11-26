import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import PanelLayout from './components/PanelLayout'
import { puedeVer } from './config/navigation'
import Avisos from './pages/panel/Avisos'
import Clientes from './pages/panel/Clientes'
import Lavados from './pages/panel/Lavados'
import Pagos from './pages/panel/Pagos'
import Recepcion from './pages/panel/Recepcion'
import Resumen from './pages/panel/Resumen'
import Servicios from './pages/panel/Servicios'
import Usuarios from './pages/panel/Usuarios'
import Inicio from './pages/public/Inicio'
import Login from './pages/public/Login'

/** Exige sesión y que el rol del usuario tenga acceso a la ruta (según config/navigation.js). */
function Protegida({ children }) {
  const { autenticado, rol } = useAuth()
  const { pathname } = useLocation()
  if (!autenticado) return <Navigate to="/ingresar" replace state={{ desde: pathname }} />
  if (!puedeVer(rol, pathname)) return <Navigate to="/panel" replace />
  return children
}

const PANTALLAS = {
  '/panel': Resumen,
  '/panel/recepcion': Recepcion,
  '/panel/lavados': Lavados,
  '/panel/clientes': Clientes,
  '/panel/pagos': Pagos,
  '/panel/avisos': Avisos,
  '/panel/servicios': Servicios,
  '/panel/usuarios': Usuarios,
}

export default function App() {
  const { autenticado } = useAuth()
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/ingresar" element={autenticado ? <Navigate to="/panel" replace /> : <Login />} />
      <Route element={autenticado ? <PanelLayout /> : <Navigate to="/ingresar" replace />}>
        {Object.entries(PANTALLAS).map(([ruta, Pantalla]) => (
          <Route
            key={ruta}
            path={ruta}
            element={
              <Protegida>
                <Pantalla />
              </Protegida>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
