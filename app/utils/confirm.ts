// Feedback reutilizable con SweetAlert2, con estilo de marca NEXA.
// Solo cliente: se importa la librería de forma dinámica para no afectar el SSR.
type FeedbackIcon = 'success' | 'error' | 'warning' | 'info' | 'question'

type FeedbackOptions = {
  titulo: string
  texto?: string
  icono?: FeedbackIcon
}

const brandConfirm = '#0a6f1f'
const dangerConfirm = '#dc2626'
const neutralCancel = '#94a39a'

async function getSwal() {
  if (!import.meta.client) {
    return null
  }

  const { default: Swal } = await import('sweetalert2')
  return Swal
}

export async function informar(opts: FeedbackOptions & {
  confirmar?: string
}): Promise<void> {
  const Swal = await getSwal()
  if (!Swal) {
    return
  }

  await Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    icon: opts.icono ?? 'info',
    confirmButtonText: opts.confirmar ?? 'Entendido',
    confirmButtonColor: brandConfirm,
  })
}

export async function notificarExito(opts: FeedbackOptions & {
  confirmar?: string
}): Promise<void> {
  await informar({
    titulo: opts.titulo,
    texto: opts.texto,
    icono: opts.icono ?? 'success',
    confirmar: opts.confirmar,
  })
}

export async function notificarError(opts: FeedbackOptions & {
  confirmar?: string
}): Promise<void> {
  await informar({
    titulo: opts.titulo,
    texto: opts.texto,
    icono: opts.icono ?? 'error',
    confirmar: opts.confirmar,
  })
}

export async function notificarValidacion(opts: FeedbackOptions): Promise<void> {
  await informar({
    titulo: opts.titulo,
    texto: opts.texto,
    icono: opts.icono ?? 'info',
  })
}

export async function notificarPermiso(texto = 'No tienes permiso para realizar esta acción.'): Promise<void> {
  await informar({
    titulo: 'Sin permiso',
    texto,
    icono: 'warning',
  })
}

export function extraerMensajeError(error: unknown, fallback: string) {
  const apiError = error as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  }

  return apiError.data?.statusMessage
    || apiError.data?.message
    || apiError.statusMessage
    || apiError.message
    || fallback
}

export async function notificarErrorApi(titulo: string, error: unknown, fallback: string): Promise<string> {
  const message = extraerMensajeError(error, fallback)
  await notificarError({ titulo, texto: message })
  return message
}

export async function confirmarAccion(opts: {
  titulo: string
  texto?: string
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}): Promise<boolean> {
  const Swal = await getSwal()
  if (!Swal) {
    return false
  }

  const result = await Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    icon: opts.peligro ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opts.confirmar ?? 'Confirmar',
    cancelButtonText: opts.cancelar ?? 'Cancelar',
    confirmButtonColor: opts.peligro ? dangerConfirm : brandConfirm,
    cancelButtonColor: neutralCancel,
    reverseButtons: true,
    focusCancel: Boolean(opts.peligro),
  })

  return result.isConfirmed
}

export async function pedirTextoAccion(opts: {
  titulo: string
  texto?: string
  etiqueta?: string
  placeholder?: string
  confirmar?: string
  cancelar?: string
  peligro?: boolean
  maxLength?: number
  minLength?: number
  requeridoMensaje?: string
}): Promise<string | null> {
  const Swal = await getSwal()
  if (!Swal) {
    return null
  }

  const result = await Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    input: 'textarea',
    inputLabel: opts.etiqueta,
    inputPlaceholder: opts.placeholder,
    inputAttributes: {
      maxlength: String(opts.maxLength ?? 180),
    },
    icon: opts.peligro ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opts.confirmar ?? 'Confirmar',
    cancelButtonText: opts.cancelar ?? 'Cancelar',
    confirmButtonColor: opts.peligro ? dangerConfirm : brandConfirm,
    cancelButtonColor: neutralCancel,
    reverseButtons: true,
    inputValidator: (value) => {
      const minLength = opts.minLength ?? 1
      if (!value || value.trim().length < minLength) {
        return opts.requeridoMensaje ?? 'Completa este campo.'
      }
      return undefined
    },
  })

  return result.isConfirmed ? String(result.value).trim() : null
}

type AlertaCarga = {
  cerrar: () => void
  exito: (titulo: string, texto?: string) => Promise<void>
  error: (titulo: string, texto?: string) => Promise<void>
}

export async function notificarCarga(opts: {
  titulo: string
  texto?: string
}): Promise<AlertaCarga> {
  const Swal = await getSwal()
  if (!Swal) {
    return {
      cerrar: () => {},
      exito: async (_titulo: string, _texto?: string) => {},
      error: async (_titulo: string, _texto?: string) => {},
    }
  }

  void Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading()
    },
  })

  return {
    cerrar: () => Swal.close(),
    exito: async (titulo: string, texto?: string) => {
      await notificarExito({ titulo, texto })
    },
    error: async (titulo: string, texto?: string) => {
      await Swal.fire({
        icon: 'error',
        title: titulo,
        text: texto,
        confirmButtonText: 'Entendido',
        confirmButtonColor: brandConfirm,
      })
    },
  }
}
