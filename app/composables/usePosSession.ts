import { storeToRefs } from 'pinia'
import { useSessionStore } from '~/stores/session'

export type { PosSession } from '~/stores/session'

export function usePosSession() {
  return storeToRefs(useSessionStore()).session
}
