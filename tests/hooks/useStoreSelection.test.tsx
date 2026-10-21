// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStoreSelection } from '../../src/hooks/useStoreSelection'

const state = vi.hoisted(() => ({ stores: [] as unknown[] }))

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const query: Record<string, unknown> = {}
      query.select = () => query
      query.order = () => query
      query.then = (
        resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
      ) => Promise.resolve({ data: state.stores, error: null }).then(resolve, reject)
      return query
    },
  },
}))

const readStorePreference = vi.fn(() => 'store-persisted')
const writeStorePreference = vi.fn()

vi.mock('../../src/lib/storePreference', () => ({
  readStorePreference: (...args: unknown[]) => readStorePreference(...(args as [])),
  writeStorePreference: (...args: unknown[]) => writeStorePreference(...(args as [])),
}))

const stores = [
  { id: 'store-persisted', code: 'P', name: 'Loja Preferida', is_active: true, created_at: '' },
  { id: 'store-perfil', code: 'F', name: 'Loja do Perfil', is_active: true, created_at: '' },
]

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let api: ReturnType<typeof useStoreSelection> | null = null

function Harness(props: { isAdmin: boolean; preferredStoreId: string | null }) {
  api = useStoreSelection({
    userId: 'user-1',
    isAdmin: props.isAdmin,
    preferredStoreId: props.preferredStoreId,
  })
  return null
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  state.stores = stores
  readStorePreference.mockClear()
  writeStorePreference.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  api = null
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function mount(isAdmin: boolean, preferredStoreId: string | null) {
  await act(async () => {
    root.render(<Harness isAdmin={isAdmin} preferredStoreId={preferredStoreId} />)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  if (!api) throw new Error('hook não inicializado')
  return api
}

describe('useStoreSelection — escopo por loja e papel', () => {
  it('admin: a preferência do navegador define a loja inicial', async () => {
    const hook = await mount(true, null)

    expect(hook.storeId).toBe('store-persisted')
  })

  it('gerente: fica preso à loja do perfil, ignorando a preferência', async () => {
    const hook = await mount(false, 'store-perfil')

    expect(hook.storeId).toBe('store-perfil')
  })

  it('gerente: não grava a preferência de loja', async () => {
    await mount(false, 'store-perfil')

    act(() => api?.selectStore('store-persisted'))

    expect(api?.storeId).toBe('store-perfil')
    expect(writeStorePreference).not.toHaveBeenCalled()
  })

  it('admin: grava a preferência ao trocar de loja', async () => {
    await mount(true, null)

    act(() => api?.selectStore('store-perfil'))

    expect(api?.storeId).toBe('store-perfil')
    expect(writeStorePreference).toHaveBeenCalledWith('user-1', 'store-perfil')
  })

  it('só considera a loja resolvida depois da carga', async () => {
    const hook = await mount(true, null)

    expect(hook.resolved).toBe(true)
  })
})
