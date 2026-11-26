import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { configurarCliente } from '../api/client'
import { identityApi } from '../api/services'

const CLAVE = 'carwash.sesion'
const AuthContext = createContext(null)

// Lee la expiración (exp) del JWT sin verificarlo: la verificación real la hacen el Gateway y cada servicio.
function expiracionDelToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function leerSesionGuardada() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE))
    if (s?.token && s.expiraEn > Date.now()) return s
  } catch {
    /* sin sesión guardada */
  }
  return null
}

// El token vive fuera de React para que el cliente HTTP lo tenga disponible desde la primera
// petición (los efectos de los hijos corren antes que los del proveedor).
let tokenActual = leerSesionGuardada()?.token ?? null
let avisarExpiracion = () => {}
configurarCliente({
  getToken: () => tokenActual,
  onUnauthorized: () => avisarExpiracion(),
})

function persistir(sesion) {
  tokenActual = sesion?.token ?? null
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* el navegador no permite guardar: la sesión dura lo que la pestaña */
  }
}

const MENSAJE_EXPIRADA = 'Tu sesión expiró. Vuelve a ingresar.'

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesionGuardada)
  const [motivoSalida, setMotivoSalida] = useState(null)

  const cerrarSesion = useCallback((motivo = null) => {
    persistir(null)
    setSesion(null)
    setMotivoSalida(motivo)
  }, [])

  useEffect(() => {
    avisarExpiracion = () => cerrarSesion(MENSAJE_EXPIRADA)
  }, [cerrarSesion])

  // Cierra la sesión justo cuando vence el token (1 hora).
  useEffect(() => {
    if (!sesion) return undefined
    const t = setTimeout(() => cerrarSesion(MENSAJE_EXPIRADA), Math.max(0, sesion.expiraEn - Date.now()))
    return () => clearTimeout(t)
  }, [sesion, cerrarSesion])

  const iniciarSesion = useCallback(async (email, password) => {
    const r = await identityApi.login(email, password)
    const nueva = {
      token: r.accessToken,
      usuario: r.user,
      expiraEn: expiracionDelToken(r.accessToken) ?? Date.now() + 60 * 60 * 1000,
    }
    persistir(nueva)
    setMotivoSalida(null)
    setSesion(nueva)
    return nueva.usuario
  }, [])

  const actualizarUsuario = useCallback((usuario) => {
    setSesion((s) => {
      if (!s) return s
      const nueva = { ...s, usuario }
      persistir(nueva)
      return nueva
    })
  }, [])

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      rol: sesion?.usuario?.role ?? null,
      autenticado: Boolean(sesion),
      motivoSalida,
      iniciarSesion,
      cerrarSesion,
      actualizarUsuario,
    }),
    [sesion, motivoSalida, iniciarSesion, cerrarSesion, actualizarUsuario],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
