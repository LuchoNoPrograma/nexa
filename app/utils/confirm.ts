// Confirmación reutilizable con SweetAlert2, con estilo de marca NEXA.
// Solo cliente: se importa la librería de forma dinámica para no afectar el SSR.
export async function confirmarAccion(opts: {
  titulo: string
  texto?: string
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}): Promise<boolean> {
  if (!import.meta.client) {
    return false
  }

  const { default: Swal } = await import('sweetalert2')

  const result = await Swal.fire({
    title: opts.titulo,
    text: opts.texto,
    icon: opts.peligro ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: opts.confirmar ?? 'Confirmar',
    cancelButtonText: opts.cancelar ?? 'Cancelar',
    confirmButtonColor: opts.peligro ? '#dc2626' : '#0a6f1f',
    cancelButtonColor: '#94a39a',
    reverseButtons: true,
    focusCancel: Boolean(opts.peligro),
  })

  return result.isConfirmed
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
  if (!import.meta.client) {
    return {
      cerrar: () => {},
      exito: async (_titulo: string, _texto?: string) => {},
      error: async (_titulo: string, _texto?: string) => {},
    }
  }

  const { default: Swal } = await import('sweetalert2')

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
      await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: titulo,
        text: texto,
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
      })
    },
    error: async (titulo: string, texto?: string) => {
      await Swal.fire({
        icon: 'error',
        title: titulo,
        text: texto,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#0a6f1f',
      })
    },
  }
}
