import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas no arquivo .env.local.',
  )
}

const REQUEST_TIMEOUT_MS = 10000

/** Combina sinais de abort (com fallback para navegadores sem `AbortSignal.any`). */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  const anyFn = (AbortSignal as { any?: (list: AbortSignal[]) => AbortSignal }).any
  if (typeof anyFn === 'function') return anyFn(signals)
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const signals: AbortSignal[] = [controller.signal]
  if (init?.signal) {
    signals.push(init.signal)
  }
  const signal = combineSignals(signals)
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetchWithTimeout,
  },
})
