export default function Logo({ claro = false }) {
  return (
    <span className={`logo ${claro ? 'logo-claro' : ''}`}>
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--blue-500)" />
        <path d="M32 11c7 10 14 18 14 26a14 14 0 0 1-28 0c0-8 7-16 14-26z" fill="#fff" />
        <path d="M26 38a6 6 0 0 0 6 6" stroke="var(--blue-500)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </svg>
      <span className="logo-text">
        Aqua<b>Brillo</b>
        <small>Car Wash</small>
      </span>
    </span>
  )
}
