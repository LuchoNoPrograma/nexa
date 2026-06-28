export function useSaleVoidDialog() {
  async function requestReason() {
    return await pedirTextoAccion({
      titulo: 'Anular venta',
      texto: 'La venta quedará marcada como anulada, se devolverá el stock y saldrá de caja.',
      etiqueta: 'Motivo',
      placeholder: 'Ej. Venta duplicada, error de cobro, cliente canceló...',
      confirmar: 'Anular venta',
      cancelar: 'Cancelar',
      peligro: true,
      maxLength: 180,
      minLength: 4,
      requeridoMensaje: 'Indica un motivo para dejar registro.',
    })
  }

  async function success(text = 'Caja y stock fueron actualizados.') {
    await notificarExito({
      titulo: 'Venta anulada',
      texto: text,
    })
  }

  async function error(message: string) {
    await notificarError({ titulo: 'No se pudo anular', texto: message })
  }

  return {
    requestReason,
    success,
    error,
  }
}
