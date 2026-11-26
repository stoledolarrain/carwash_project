import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carga datos de la API al montar y cada vez que cambian `deps`.
 * Devuelve { datos, cargando, error, recargar }. Con `intervaloMs` se refresca solo
 * (la cola de lavados lo usa para ver los cambios de otros usuarios).
 */
export function useApi(cargar, deps = [], { intervaloMs } = {}) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null })
  const [version, setVersion] = useState(0)
  const cargarRef = useRef(cargar)

  useEffect(() => {
    cargarRef.current = cargar
  })

  useEffect(() => {
    let vigente = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado((s) => ({ ...s, cargando: true, error: null }))
    cargarRef
      .current()
      .then((datos) => vigente && setEstado({ datos, cargando: false, error: null }))
      .catch((error) => vigente && setEstado((s) => ({ datos: s.datos, cargando: false, error })))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  useEffect(() => {
    if (!intervaloMs) return undefined
    const t = setInterval(() => {
      cargarRef
        .current()
        .then((datos) => setEstado({ datos, cargando: false, error: null }))
        .catch(() => {})
    }, intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { ...estado, recargar }
}
