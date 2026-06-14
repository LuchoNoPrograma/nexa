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
