import { requireSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  return {
    user: await requireSession(event),
  }
})
