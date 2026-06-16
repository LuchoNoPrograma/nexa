export type PosSession = {
  id: string
  email: string
  name: string
  role: string
  store: string
  storeId: string | null
  defaultMargin: number | null
  onboardingDiagnostico: 'pendiente' | 'completado' | 'omitido' | null
  roles: string[]
  permisos: string[]
}

export function usePosSession() {
  return useState<PosSession | null>('nexa-pos-session', () => null)
}

