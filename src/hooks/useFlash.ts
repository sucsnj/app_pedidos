import { useCallback, useRef, useState } from 'react'
import type { FlashKind, FlashState } from '../types/app'

export function useFlash() {
  const [flash, setFlash] = useState<FlashState | null>(null)
  const flashTimer = useRef<number | null>(null)

  const notify = useCallback((message: string, kind: FlashKind = 'info') => {
    setFlash({ message, kind })
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 3500)
  }, [])

  return { flash, notify }
}
