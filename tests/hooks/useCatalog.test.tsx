// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Catalog } from '../../src/types/app'
import { useCatalog } from '../../src/hooks/useCatalog'

const cachedCatalog: Catalog = {
  stores: [
    {
      id: 'store-1',
      code: 'L1',
      name: 'Loja Central',
      is_active: true,
      created_at: '2026-01-01',
    },
  ],
  categories: [],
  products: [],
  variations: [],
}

const readCatalog = vi.fn(async (): Promise<Catalog | null> => cachedCatalog)
const cacheCatalog = vi.fn(async () => undefined)

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      // query encadeável (`.select().order().order()`) que sempre falha como rede
      const query: Record<string, unknown> = {}
      query.select = () => query
      query.order = () => query
      query.then = (
        resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
      ) =>
        Promise.resolve({ data: null, error: new TypeError('Failed to fetch') }).then(
          resolve,
          reject,
        )
      return query
    },
  },
}))

vi.mock('../../src/lib/localCache', () => ({
  readCatalog: (...args: unknown[]) => readCatalog(...(args as [])),
  cacheCatalog: (...args: unknown[]) => cacheCatalog(...(args as [])),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let api: ReturnType<typeof useCatalog> | null = null

function Harness() {
  api = useCatalog()
  return null
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  readCatalog.mockClear()
  cacheCatalog.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api = null
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function mount() {
  await act(async () => {
    root.render(<Harness />)
  })
  // deixa o fallback (async) resolver e o React aplicar o estado
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  if (!api) throw new Error('hook não inicializado')
  return api
}

describe('useCatalog — fallback offline pelo espelho local', () => {
  it('usa o catálogo espelhado quando a rede falha (sem erro na tela)', async () => {
    const hook = await mount()

    expect(readCatalog).toHaveBeenCalled()
    expect(hook.error).toBeNull()
    expect(hook.catalog.stores).toHaveLength(1)
    expect(hook.catalog.stores[0].name).toBe('Loja Central')
  })

  it('reporta o erro quando não há espelho do catálogo', async () => {
    readCatalog.mockResolvedValueOnce(null)

    const hook = await mount()

    expect(hook.error).not.toBeNull()
    expect(hook.catalog.stores).toHaveLength(0)
  })
})
