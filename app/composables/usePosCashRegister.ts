import { storeToRefs } from 'pinia'
import { useCashStore } from '~/stores/cash'

export function usePosCashRegister() {
  const store = useCashStore()
  const { cashStatus, cashSession, cashSessionId, movements, productSales, isLoading } = storeToRefs(store)

  return {
    cashStatus,
    cashSession,
    cashSessionId,
    movements,
    productSales,
    isLoading,
    loadCashData: store.loadCashData,
    refreshInBackground: store.refreshInBackground,
    addManualMovement: store.addManualMovement,
    registerSale: store.registerSale,
    reserveSaleSequence: store.reserveSaleSequence,
    voidSale: store.voidSale,
    voidManualMovement: store.voidManualMovement,
    closeTurn: store.closeTurn,
    openTurn: store.openTurn,
  }
}
