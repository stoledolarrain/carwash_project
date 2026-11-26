import { useEffect, useRef } from 'react'
import { ESTADOS_ORDEN } from '../config/navigation'
import Icon from './Icon'

export function Button({ variant = 'primary', size, icon, loading = false, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Modal({ abierto, titulo, onCerrar, children, ancho = 520 }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])
  return (
    <dialog
      ref={ref}
      className="modal"
      style={{ '--modal-w': `${ancho}px` }}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => e.target === ref.current && onCerrar()}
    >
      {abierto && (
        <div className="modal-body">
          <header className="modal-head">
            <h2>{titulo}</h2>
            <button type="button" className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
              <Icon name="x" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function EstadoBadge({ estado }) {
  const e = ESTADOS_ORDEN[estado] || { etiqueta: estado, tono: 'neutro' }
  return <span className={`badge badge-${e.tono}`}>{e.etiqueta}</span>
}

export function Badge({ tono = 'neutro', children }) {
  return <span className={`badge badge-${tono}`}>{children}</span>
}

export function Spinner({ texto = 'Cargando…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

export function Vacio({ icono = 'sparkle', titulo, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icono} size={26} />
      </span>
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function ErrorCaja({ error, onReintentar }) {
  if (!error) return null
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <strong>{error.message}</strong>
        {error.details?.length > 0 && (
          <ul>
            {error.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      {onReintentar && (
        <Button variant="ghost" size="sm" icon="refresh" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Tarjeta({ titulo, acciones, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(titulo || acciones) && (
        <header className="card-head">
          {titulo && <h2>{titulo}</h2>}
          {acciones}
        </header>
      )}
      {children}
    </section>
  )
}
