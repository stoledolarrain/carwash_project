// Ilustración propia: auto de perfil con espuma y gotas de agua.
export default function CarIllustration({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 520 300" role="img" aria-label="Auto recién lavado con espuma">
      <defs>
        <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6e9fb" />
        </linearGradient>
        <linearGradient id="carGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd6f7" />
          <stop offset="1" stopColor="#1a73e8" />
        </linearGradient>
      </defs>
      <ellipse cx="262" cy="262" rx="220" ry="14" fill="#000" opacity=".22" />
      {/* carrocería */}
      <path
        d="M60 218c-8 0-14-6-14-14v-26c0-14 9-25 22-29l62-17 52-48c10-9 23-14 37-14h112c15 0 29 6 39 17l40 44 38 8c16 3 27 17 27 33v32c0 8-6 14-14 14z"
        fill="url(#carBody)"
      />
      {/* ventanas */}
      <path d="M196 98c7-6 15-9 24-9h58v52H150z" fill="url(#carGlass)" />
      <path d="M294 89h44c10 0 19 4 26 12l36 40H294z" fill="url(#carGlass)" />
      <path d="M210 104l-22 32M318 98l-26 38" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".55" />
      {/* línea de puerta y manija */}
      <path d="M286 146v62M150 150h294" stroke="#9cc3ea" strokeWidth="3" />
      <rect x="236" y="160" width="26" height="6" rx="3" fill="#9cc3ea" />
      <rect x="330" y="160" width="26" height="6" rx="3" fill="#9cc3ea" />
      {/* faros */}
      <path d="M452 168h22c6 0 10 4 10 10v4h-30z" fill="#ffd166" />
      <rect x="50" y="170" width="20" height="12" rx="4" fill="#ff6b6b" />
      {/* ruedas */}
      {[150, 392].map((x) => (
        <g key={x}>
          <circle cx={x} cy="218" r="40" fill="#0a1f44" />
          <circle cx={x} cy="218" r="22" fill="#c8d6e8" />
          <circle cx={x} cy="218" r="8" fill="#0a1f44" />
        </g>
      ))}
      {/* espuma */}
      {[
        [96, 140, 18], [124, 128, 14], [430, 146, 16], [458, 156, 12], [246, 78, 12], [270, 70, 9],
        [70, 196, 10], [480, 200, 9],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#fff" stroke="#bfe6fb" strokeWidth="2" />
      ))}
      {/* gotas */}
      {[[40, 60], [120, 30], [470, 50], [500, 110], [20, 130]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y}c5 8 10 13 10 19a10 10 0 0 1-20 0c0-6 5-11 10-19z`} fill="#22b8ec" opacity=".85" />
      ))}
      {/* destellos */}
      <path d="M350 40l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#fff" />
      <path d="M180 56l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" opacity=".8" />
    </svg>
  )
}
