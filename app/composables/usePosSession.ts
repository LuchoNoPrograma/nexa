export type PosSession = {
  id: string
  email: string
  name: string
  role: string
  store: string
  storeId: string | null
  defaultMargin: number | null
}

export function usePosSession() {
  return useState<PosSession | null>('nexa-pos-session', () => null)
}

