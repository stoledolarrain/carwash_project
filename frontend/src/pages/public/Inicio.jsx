import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { comoLista } from '../../api/client'
import { catalogApi } from '../../api/services'
import { useAuth } from '../../auth/AuthContext'
import CarIllustration from '../../components/CarIllustration'
import Icon from '../../components/Icon'
import Logo from '../../components/Logo'
import { useApi } from '../../hooks/useApi'
import { bs } from '../../utils/format'

const PASOS = [
  { n: '01', titulo: 'Llegas con tu auto', texto: 'En recepción registramos tu vehículo por su placa. Si ya viniste antes, te reconocemos al instante.' },
  { n: '02', titulo: 'Eliges tus servicios', texto: 'Del lavado exterior al detallado completo, con precio y tiempo claros desde el inicio.' },
  { n: '03', titulo: 'Te avisamos', texto: 'Recibes un aviso cuando empieza el lavado y otro cuando tu vehículo está listo para recoger.' },
  { n: '04', titulo: 'Pagas y lo recoges', texto: 'Efectivo, QR o tarjeta. Tu historial de lavados queda guardado para la próxima visita.' },
]

const VENTAJAS = [
  { icono: 'clock', titulo: 'Atención sin esperas', texto: 'Cola de trabajo ordenada en tiempo real.' },
  { icono: 'shield', titulo: 'Cuidamos tu pintura', texto: 'Productos neutros y microfibra en cada paso.' },
  { icono: 'users', titulo: 'Equipo capacitado', texto: 'Personal especializado en cada servicio.' },
]

export default function Inicio() {
  const { autenticado } = useAuth()
  const [menu, setMenu] = useState(false)
  const { datos, cargando, error } = useApi(() => catalogApi.serviciosActivos(), [])
  const servicios = useMemo(() => comoLista(datos), [datos])

  // Tres planes de precio a partir de los servicios reales del catálogo: el más económico, uno medio y el más completo.
  const planes = useMemo(() => {
    const orden = [...servicios].sort((a, b) => a.price - b.price)
    if (orden.length < 3) return orden
    return [orden[0], orden[Math.floor(orden.length / 2)], orden[orden.length - 1]]
  }, [servicios])

  const ctaPanel = autenticado ? { to: '/panel', texto: 'Ir al panel' } : { to: '/ingresar', texto: 'Ingresar' }

  return (
    <div className="site">
      <div className="site-topbar">
        <div className="wrap">
          <span><Icon name="clock" size={16} /> Lunes a sábado · 08:00 – 19:00</span>
          <span><Icon name="phone" size={16} /> +591 700 00000</span>
        </div>
      </div>

      <header className={`site-header ${menu ? 'abierto' : ''}`}>
        <div className="wrap site-header-inner">
          <Link to="/" aria-label="AquaBrillo, inicio"><Logo /></Link>
          <nav className="site-nav" onClick={() => setMenu(false)}>
            <a href="#servicios">Servicios</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#contacto">Contacto</a>
          </nav>
          <Link to={ctaPanel.to} className="btn btn-primary site-cta">
            <span>{ctaPanel.texto}</span>
            <Icon name="arrow" size={18} />
          </Link>
          <button type="button" className="icon-btn site-menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menú">
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-bubbles" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <span className="eyebrow eyebrow-light"><Icon name="sparkle" size={16} /> Lavado profesional de vehículos</span>
            <h1>Tu auto brillante <span>como el primer día</span></h1>
            <p>
              Lavado exterior, aspirado, interiores y detallado con productos que cuidan la pintura.
              Te avisamos apenas tu vehículo esté listo.
            </p>
            <div className="hero-actions">
              <a href="#servicios" className="btn btn-accent btn-lg">Ver servicios</a>
              <a href="#contacto" className="btn btn-outline-light btn-lg">Contáctanos</a>
            </div>
            <dl className="hero-stats">
              <div><dt>+10</dt><dd>años de experiencia</dd></div>
              <div><dt>{servicios.length || '—'}</dt><dd>servicios disponibles</dd></div>
              <div><dt>3</dt><dd>formas de pago</dd></div>
            </dl>
          </div>
          <CarIllustration className="hero-car" />
        </div>
        <svg className="hero-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40c240 40 480 40 720 0s480-40 720 0v40H0z" fill="var(--sky-50)" />
        </svg>
      </section>

      <section className="ventajas">
        <div className="wrap ventajas-grid">
          {VENTAJAS.map((v) => (
            <div key={v.titulo} className="ventaja">
              <span className="ventaja-icon"><Icon name={v.icono} size={24} /></span>
              <div>
                <strong>{v.titulo}</strong>
                <p>{v.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="servicios" className="seccion">
        <div className="wrap">
          <div className="seccion-head">
            <span className="eyebrow">Lo que hacemos</span>
            <h2>Nuestros servicios</h2>
            <p>Precios y tiempos oficiales, actualizados al momento desde nuestro catálogo.</p>
          </div>
          {cargando && <p className="muted center">Cargando servicios…</p>}
          {error && <p className="muted center">No pudimos cargar los servicios en este momento.</p>}
          {!cargando && !error && servicios.length === 0 && <p className="muted center">Pronto publicaremos nuestros servicios.</p>}
          <div className="servicios-grid">
            {servicios.map((s, i) => (
              <article key={s.id} className="servicio-card">
                <span className="servicio-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="servicio-icon"><Icon name={i % 3 === 0 ? 'services' : i % 3 === 1 ? 'car' : 'sparkle'} size={28} /></span>
                <h3>{s.name}</h3>
                <p>{s.description || 'Servicio profesional de lavado.'}</p>
                <footer>
                  <span className="servicio-precio">{bs(s.price)}</span>
                  <span className="servicio-tiempo"><Icon name="clock" size={16} /> {s.estimatedDuration} min</span>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="seccion seccion-oscura">
        <div className="wrap">
          <div className="seccion-head">
            <span className="eyebrow eyebrow-light">Simple y rápido</span>
            <h2>Cómo funciona</h2>
          </div>
          <ol className="pasos">
            {PASOS.map((p) => (
              <li key={p.n} className="paso">
                <span className="paso-n">{p.n}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {planes.length > 0 && (
        <section id="precios" className="seccion">
          <div className="wrap">
            <div className="seccion-head">
              <span className="eyebrow">Planes</span>
              <h2>Precios claros</h2>
              <p>Sin sorpresas: pagas lo que ves.</p>
            </div>
            <div className="planes">
              {planes.map((s, i) => (
                <article key={s.id} className={`plan ${planes.length === 3 && i === 1 ? 'plan-destacado' : ''}`}>
                  {planes.length === 3 && i === 1 && <span className="plan-tag">Más elegido</span>}
                  <h3>{s.name}</h3>
                  <p className="plan-precio">{bs(s.price)}</p>
                  <p className="plan-tiempo"><Icon name="clock" size={16} /> {s.estimatedDuration} minutos</p>
                  <p className="plan-desc">{s.description}</p>
                  <a href="#contacto" className={`btn ${planes.length === 3 && i === 1 ? 'btn-accent' : 'btn-primary'}`}>Lo quiero</a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="contacto" className="contacto">
        <div className="wrap contacto-inner">
          <div>
            <h2>¿Listo para que tu auto brille?</h2>
            <p>Ven sin cita o escríbenos para consultar disponibilidad.</p>
          </div>
          <div className="contacto-datos">
            <span><Icon name="phone" /> +591 700 00000</span>
            <span><Icon name="mail" /> contacto@aquabrillo.bo</span>
            <span><Icon name="map" /> Av. Principal 123, Santa Cruz</span>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap site-footer-inner">
          <Logo claro />
          <p>Proyecto académico · Ingeniería Web III · Plataforma de gestión para Car Wash</p>
          <Link to={ctaPanel.to}>{autenticado ? 'Ir al panel' : 'Acceso del personal'}</Link>
        </div>
      </footer>
    </div>
  )
}
