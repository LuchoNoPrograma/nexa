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
  return useState<PosSession | null>('impulsa-pos-session', () => null)
}

