const trigger = ref(0)

export function useHaruChat() {
  return {
    trigger,
    open: () => trigger.value++,
  }
}
