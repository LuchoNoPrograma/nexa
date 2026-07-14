const PRINT_FRAME_TIMEOUT_MS = 60_000

export function printHtmlDocument(html: string) {
  if (!import.meta.client) {
    return false
  }

  const frame = document.createElement('iframe')
  let cleanupTimer: ReturnType<typeof window.setTimeout> | undefined

  const cleanup = () => {
    if (cleanupTimer) {
      window.clearTimeout(cleanupTimer)
    }
    frame.remove()
  }

  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '1px'
  frame.style.height = '1px'
  frame.style.border = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'

  frame.addEventListener('load', () => {
    const printWindow = frame.contentWindow

    if (!printWindow) {
      cleanup()
      return
    }

    printWindow.addEventListener('afterprint', cleanup, { once: true })
    cleanupTimer = window.setTimeout(cleanup, PRINT_FRAME_TIMEOUT_MS)
    printWindow.focus()
    printWindow.print()
  }, { once: true })

  frame.srcdoc = html
  document.body.appendChild(frame)
  return true
}
