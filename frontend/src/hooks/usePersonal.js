import { useMemo } from 'react'
import { comoLista } from '../api/client'
import { identityApi } from '../api/services'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../config/navigation'
import { idCorto } from '../utils/format'
import { useApi } from './useApi'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Personal del car wash para asignar lavados y mostrar nombres.
 * Solo el ADMIN puede listar usuarios en Identity; para los demás roles se muestra
 * el nombre propio ("Tú") o el identificador guardado en la orden.
 */
export function usePersonal() {
  const { usuario, rol } = useAuth()
  const esAdmin = rol === ROLES.ADMIN
  const { datos } = useApi(
    // Se cargan también los inactivos para mostrar el nombre en órdenes antiguas.
    () => (esAdmin ? identityApi.listarUsuarios({ pageSize: 100 }) : Promise.resolve([])),
    [esAdmin],
  )
  const usuarios = useMemo(() => comoLista(datos), [datos])

  return useMemo(() => {
    const porId = new Map(usuarios.map((u) => [u.id, u.fullName]))
    const nombre = (responsableId) => {
      if (!responsableId) return 'Sin asignar'
      if (responsableId === usuario?.id) return `${usuario.fullName} (tú)`
      if (porId.has(responsableId)) return porId.get(responsableId)
      return UUID.test(responsableId) ? `Personal ${idCorto(responsableId)}` : responsableId
    }
    const lavadores = usuarios.filter((u) => u.role === ROLES.WASHER && u.isActive)
    return { nombre, lavadores, puedeListar: esAdmin }
  }, [usuarios, usuario, esAdmin])
}
