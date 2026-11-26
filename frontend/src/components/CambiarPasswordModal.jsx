import { useState } from 'react'
import { identityApi } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { Button, ErrorCaja, Field, Modal } from './ui'

export default function CambiarPasswordModal({ abierto, onCerrar }) {
  const { cerrarSesion } = useAuth()
  const toast = useToast()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const cerrar = () => {
    setActual('')
    setNueva('')
    setError(null)
    onCerrar()
  }

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await identityApi.cambiarMiPassword(actual, nueva)
      toast.ok('Contraseña actualizada. Ingresa de nuevo con la nueva contraseña.')
      cerrar()
      // Identity invalida los tokens anteriores al cambiar la contraseña.
      cerrarSesion('Cambiaste tu contraseña. Ingresa con la nueva.')
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} titulo="Cambiar mi contraseña" onCerrar={cerrar} ancho={440}>
      <form onSubmit={enviar} className="form">
        <ErrorCaja error={error} />
        <Field label="Contraseña actual">
          <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
        </Field>
        <Field label="Nueva contraseña" hint="Al menos 8 caracteres, con letras y números.">
          <input type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </Field>
        <div className="form-actions">
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
