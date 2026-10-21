// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Catalog } from '../types/app'
import { Dashboard } from './Dashboard'

const catalog: Catalog = {
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

const sessionState = vi.hoisted(() => ({
  offline: true,
  sessionError: null as string | null,
  catalogError: null as string | null,
}))

vi.mock('../hooks/useOnline', () => ({
  useOnline: () => !sessionState.offline,
}))

vi.mock('../hooks/useCatalog', () => ({
  useCatalog: () => ({
    catalog,
    loading: false,
    error: sessionState.catalogError,
    reload: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useFlash', () => ({
  useFlash: () => ({ flash: null, notify: vi.fn() }),
}))

vi.mock('../hooks/usePendingSync', () => ({
  usePendingSync: () => ({ pending: 0, refresh: vi.fn() }),
}))

vi.mock('../hooks/useStoreReports', () => ({
  useStoreReports: () => ({ lastOrder: null, report: null, bumpReport: vi.fn() }),
}))

vi.mock('../hooks/useStoreSession', () => ({
  useStoreSession: () => ({
    activeStoreId: 'store-1',
    orders: [],
    currentOrder: null,
    items: [],
    suggestions: new Map(),
    requesterName: '',
    notes: '',
    loading: false,
    error: sessionState.sessionError,
    saving: false,
    finishing: false,
    savedAt: null,
    setRequesterName: vi.fn(),
    setNotes: vi.fn(),
    adjust: vi.fn(),
    setQuantity: vi.fn(),
    toggleEntered: vi.fn(),
    selectStore: vi.fn(),
    selectOrder: vi.fn(),
    newCount: vi.fn(),
    finishOrder: vi.fn(),
    saveNow: vi.fn(),
    flushDraft: vi.fn(),
    refreshCurrentOrder: vi.fn(),
    clearError: vi.fn(),
  }),
}))

vi.mock('../lib/offlineQueue', () => ({
  flushQueue: vi.fn(async () => ({ flushed: 0, remaining: 0 })),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  sessionState.offline = true
  sessionState.sessionError = null
  sessionState.catalogError = null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function screenText(): string {
  return (container.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')
}

async function mount() {
  await act(async () => {
    root.render(
      <Dashboard
        profile={null}
        isAdmin={false}
        currentUserId="user-1"
      />,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('Dashboard — comportamento offline', () => {
  it('exibe o app (não a tela de erro) quando offline e sem erro de carga', async () => {
    await mount()

    expect(screenText()).not.toContain('Não foi possível carregar o app')
    expect(screenText()).toContain('Sem conexão')
  })

  it('mostra a tela de erro quando offline e a carga falhou de verdade', async () => {
    sessionState.sessionError = 'Falha ao carregar a loja'
    await mount()

    expect(screenText()).toContain('Não foi possível carregar o app')
    expect(screenText()).toContain('Sem conexão')
  })

  it('mostra a tela de erro quando online e a carga falhou', async () => {
    sessionState.offline = false
    sessionState.sessionError = 'Falha ao carregar a loja'
    await mount()

    expect(screenText()).toContain('Não foi possível carregar o app')
    expect(screenText()).toContain('Falha ao carregar a loja')
  })
})
