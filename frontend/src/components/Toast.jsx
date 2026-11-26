import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Icon from './Icon'

const ToastContext = createContext({ ok: () => {}, error: () => {} })
let contador = 0

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])

  const notificar = useCallback((mensaje, tipo = 'ok') => {
    const id = ++contador
    setAvisos((a) => [...a, { id, mensaje, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4200)
  }, [])

  const api = useMemo(
    () => ({ ok: (m) => notificar(m, 'ok'), error: (m) => notificar(m, 'error') }),
    [notificar],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`toast toast-${a.tipo}`}>
            <Icon name={a.tipo === 'ok' ? 'check' : 'x'} size={18} />
            <span>{a.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
