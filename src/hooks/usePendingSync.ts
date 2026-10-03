import { useCallback, useEffect, useState } from 'react'
import { pendingCount, subscribePending } from '../lib/offlineQueue'

export function usePendingSync(): { pending: number; refresh: () => void } {
  const [pending, setPending] = useState(0)

  useEffect(() => subscribePending(setPending), [])

  const refresh = useCallback(() => {
    void pendingCount()
      .then(setPending)
      .catch(() => undefined)
  }, [])

  return { pending, refresh }
}