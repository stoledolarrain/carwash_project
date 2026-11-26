import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import CarIllustration from '../../components/CarIllustration'
import Icon from '../../components/Icon'
import Logo from '../../components/Logo'
import { Button, ErrorCaja, Field } from '../../components/ui'
import { puedeVer } from '../../config/navigation'

export default function Login() {
  const { iniciarSesion, motivoSalida } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const usuario = await iniciarSesion(email.trim(), password)
      const destino = state?.desde && puedeVer(usuario.role, state.desde) ? state.desde : '/panel'
      navigate(destino, { replace: true })
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <aside className="login-art">
        <div className="hero-bubbles" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
        </div>
        <Link to="/"><Logo claro /></Link>
        <div className="login-art-copy">
          <h2>Panel de gestión</h2>
          <p>Recepción, cola de lavados, pagos y avisos en un solo lugar.</p>
        </div>
        <CarIllustration className="login-car" />
      </aside>

      <main className="login-main">
        <form className="login-form" onSubmit={enviar}>
          <Link to="/" className="login-back"><Icon name="arrow" size={16} className="flip" /> Volver al sitio</Link>
          <h1>Ingresar</h1>
          <p className="muted">Acceso exclusivo para el personal del car wash.</p>

          {motivoSalida && !error && <div className="alert alert-info">{motivoSalida}</div>}
          <ErrorCaja error={error} />

          <Field label="Correo electrónico">
            <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@carwash.local" />
          </Field>
          <Field label="Contraseña">
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={enviando} className="btn-block">Ingresar</Button>
          <p className="field-hint center">¿Olvidaste tu contraseña? Pide al administrador que la restablezca.</p>
        </form>
      </main>
    </div>
  )
}
