export function useSaleVoidDialog() {
  async function requestReason() {
    const { default: Swal } = await import('sweetalert2')
    const result = await Swal.fire({
      title: 'Anular venta',
      text: 'La venta quedará marcada como anulada, se devolverá el stock y saldrá de caja.',
      input: 'textarea',
      inputLabel: 'Motivo',
      inputPlaceholder: 'Ej. Venta duplicada, error de cobro, cliente canceló...',
      inputAttributes: {
        maxlength: '180',
      },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Anular venta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => {
        if (!value || value.trim().length < 4) {
          return 'Indica un motivo para dejar registro.'
        }
        return undefined
      },
    })

    return result.isConfirmed ? String(result.value).trim() : null
  }

  async function success(text = 'Caja y stock fueron actualizados.') {
    const { default: Swal } = await import('sweetalert2')
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Venta anulada',
      text,
      showConfirmButton: false,
      timer: 2600,
      timerProgressBar: true,
    })
  }

  async function error(message: string) {
    const { default: Swal } = await import('sweetalert2')
    await Swal.fire({
      icon: 'error',
      title: 'No se pudo anular',
      text: message,
      confirmButtonText: 'Entendido',
    })
  }

  return {
    requestReason,
    success,
    error,
  }
}
