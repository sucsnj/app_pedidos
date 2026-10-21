const STORAGE_PREFIX = 'pedidos:card:'

/** Lê o estado (aberto/fechado) de um card persistido no navegador. */
export function readCardState(storageKey: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey)
    if (raw === null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

/** Grava o estado (aberto/fechado) de um card no navegador. */
export function writeCardState(storageKey: string, open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, open ? '1' : '0')
  } catch {
    // Sem storage disponível (modo privado) — segue sem persistir.
  }
}

/** Lê um conjunto de ids guardados (ex.: categorias colapsadas da contagem). */
export function readCardIdSet(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Grava um conjunto de ids no navegador. */
export function writeCardIdSet(storageKey: string, ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(ids))
  } catch {
    // Sem storage disponível (modo privado) — segue sem persistir.
  }
}
