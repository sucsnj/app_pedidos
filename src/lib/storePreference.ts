const STORE_PREFERENCE_KEY = 'pedidos:selectedStore:'

/** Loja preferida do usuário (gravada no `localStorage`, por usuário). */
export function readStorePreference(userId: string | null | undefined): string | null {
  if (!userId) return null
  try {
    return window.localStorage.getItem(STORE_PREFERENCE_KEY + userId)
  } catch {
    return null
  }
}

export function writeStorePreference(
  userId: string | null | undefined,
  storeId: string,
): void {
  if (!userId) return
  try {
    window.localStorage.setItem(STORE_PREFERENCE_KEY + userId, storeId)
  } catch {
    // Sem storage disponível — segue sem gravar a preferência.
  }
}
