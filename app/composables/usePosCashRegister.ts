import { storeToRefs } from 'pinia'
import { useCashStore } from '~/stores/cash'

export function usePosCashRegister() {
  const store = useCashStore()
  const { cashStatus, cashSession, movements, productSales, isLoading } = storeToRefs(store)

  return {
    cashStatus,
    cashSession,
    movements,
    productSales,
    isLoading,
    loadCashData: store.loadCashData,
    refreshInBackground: store.refreshInBackground,
    addManualMovement: store.addManualMovement,
    registerSale: store.registerSale,
    closeTurn: store.closeTurn,
    openTurn: store.openTurn,
  }
}
