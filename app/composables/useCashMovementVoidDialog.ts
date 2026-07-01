import type { PosCashMovementType } from '~/stores/cash'

export function useCashMovementVoidDialog() {
  async function requestReason(type: PosCashMovementType) {
    const movementLabel = type === 'Egreso' ? 'gasto' : 'ingreso'

    return await pedirTextoAccion({
      titulo: `Anular ${movementLabel}`,
      texto: `El ${movementLabel} saldrá de los totales de caja y quedará registrado como anulado.`,
      etiqueta: 'Motivo',
      placeholder: 'Ej. Registro duplicado, monto incorrecto...',
      confirmar: `Anular ${movementLabel}`,
      cancelar: 'Cancelar',
      peligro: true,
      maxLength: 180,
      minLength: 4,
      requeridoMensaje: 'Indica un motivo para dejar registro.',
    })
  }

  async function success(type: PosCashMovementType) {
    await notificarExito({
      titulo: type === 'Egreso' ? 'Gasto anulado' : 'Ingreso anulado',
      texto: 'Los totales de caja fueron actualizados.',
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
