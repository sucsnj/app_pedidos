// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CountingBoard } from '../../src/components/CountingBoard'
import type { Catalog } from '../../src/types/app'

const catalog: Catalog = {
  stores: [],
  categories: [
    { id: 'cat-1', name: 'Bebidas', display_order: 1, created_at: '2026-01-01' },
  ],
  products: [
    {
      id: 'p1',
      category_id: 'cat-1',
      code: '100',
      name: 'Leite',
      unit_type: 'UN',
      is_active: true,
      display_order: 1,
      created_at: '2026-01-01',
    },
  ],
  variations: [],
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render() {
  act(() => {
    root.render(
      <CountingBoard
        storeName="Loja Central"
        categories={catalog.categories}
        products={catalog.products}
        variations={catalog.variations}
        items={[]}
        suggestions={new Map()}
        requesterName=""
        notes=""
        orderStatus="Rascunho"
        saving={false}
        savedAt={null}
        lastOrder={null}
        onRequesterNameChange={vi.fn()}
        onNotesChange={vi.fn()}
        onAdjust={vi.fn()}
        onSetQuantity={vi.fn()}
        onSaveNow={vi.fn()}
      />,
    )
  })
}

function categoryButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes('Bebidas'),
  )
  if (!button) throw new Error('cabeçalho da categoria não encontrado')
  return button
}

describe('CountingBoard — categorias colapsadas persistidas', () => {
  it('mantém a categoria colapsada ao remontar', () => {
    render()

    const header = categoryButton()
    expect(header.getAttribute('aria-expanded')).toBe('true')

    act(() => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem('pedidos:card:contagem-categorias')).toBe('["cat-1"]')

    act(() => root.unmount())
    root = createRoot(container)
    render()

    expect(categoryButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('expande de novo e limpa o estado gravado', () => {
    render()

    act(() => categoryButton().click())
    act(() => categoryButton().click())

    expect(categoryButton().getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('pedidos:card:contagem-categorias')).toBe('[]')
  })
})
