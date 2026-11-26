// Íconos de trazo (24x24) dibujados a mano para no depender de una librería.
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  reception: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6M4 20h16',
  queue: 'M5 7h14M5 12h14M5 17h9M19 15v4m-2-2h4',
  customers: 'M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19c0-1.9-1.3-3.4-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  payments: 'M3 7h18v10H3zM3 10h18M7 14h3',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  services: 'M12 3c3 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 3-6.5 6-11zM9.5 15a2.5 2.5 0 0 0 2.5 2.5',
  users: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  car: 'M5 16H3v-4l2-5h11l3 5h2v4h-2M7 16h8M7.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 12h13',
  check: 'M5 12.5l4.5 4.5L19 7',
  play: 'M8 5l11 7-11 7z',
  handover: 'M3 13h4l3 3h4a2 2 0 0 0 0-4h-3M7 13V9h5l4 3M14 5l3-2 4 4-3 2',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  key: 'M14.5 9.5a4 4 0 1 0-5 3.9V20h3v-2h2v-2h-2v-2.6a4 4 0 0 0 2-3.9z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  map: 'M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  power: 'M12 3v8M7 6a7 7 0 1 0 10 0',
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.8 }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.sparkle} />
    </svg>
  )
}
