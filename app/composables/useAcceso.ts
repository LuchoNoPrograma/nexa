import { tieneAcceso, type AccesoSesion } from '~~/shared/utils/acceso'

// Acceso reactivo basado en la sesión del POS. Uso:
//   const { puede } = useAcceso()
//   puede('CAJA || ADMINISTRADOR')
export function useAcceso() {
  const session = usePosSession()

  const sesion = computed<AccesoSesion>(() => ({
    roles: session.value?.roles ?? [],
    permisos: session.value?.permisos ?? [],
  }))

  function puede(expr: string | undefined | null) {
    return tieneAcceso(expr, sesion.value)
  }

  return { puede, sesion }
}
