import { registerSW } from 'virtual:pwa-register'

export interface PWAStatus {
  needsRefresh: boolean
  offlineReady: boolean
}

type UpdateSW = (reloadPage?: boolean) => Promise<void>

const DEFAULT_STATUS: PWAStatus = { needsRefresh: false, offlineReady: false }

let status: PWAStatus = DEFAULT_STATUS
let updateSW: UpdateSW | null = null
const listeners = new Set<(s: PWAStatus) => void>()
let registered = false

function emit(): void {
  const snapshot = status
  listeners.forEach((listener) => listener(snapshot))
}

export function setupPWA(): void {
  if (registered || import.meta.env.DEV) return
  registered = true
  updateSW = registerSW({
    onNeedRefresh() {
      status = { ...status, needsRefresh: true }
      emit()
    },
    onOfflineReady() {
      status = { ...status, offlineReady: true }
      emit()
    },
  })
}

export function subscribePWA(onChange: (s: PWAStatus) => void): () => void {
  listeners.add(onChange)
  onChange(status)
  return () => {
    listeners.delete(onChange)
  }
}

export function dismissUpdate(): void {
  status = { ...status, needsRefresh: false }
  emit()
}

export function dismissOfflineReady(): void {
  status = { ...status, offlineReady: false }
  emit()
}

export function applyUpdate(): void {
  if (updateSW) void updateSW(true)
}