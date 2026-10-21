// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogBoard } from '../../src/components/CatalogBoard'
import type { Catalog } from '../../src/types/app'

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
      <CatalogBoard catalog={catalog} onRefresh={vi.fn()} onFlash={vi.fn()} />,
    )
  })
}

function headerButton(title: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(title),
  )
  if (!button) throw new Error(`seção "${title}" não encontrada`)
  return button
}

describe('CatalogBoard — colapso persistido', () => {
  it('mantém a seção colapsada ao remontar', () => {
    render()

    const lojas = headerButton('Lojas / Filiais')
    expect(lojas.getAttribute('aria-expanded')).toBe('true')

    act(() => lojas.click())
    expect(lojas.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem('pedidos:card:catalogo-lojas')).toBe('0')

    act(() => root.unmount())
    root = createRoot(container)
    render()

    expect(headerButton('Lojas / Filiais').getAttribute('aria-expanded')).toBe('false')
  })

  it('expande de volta e grava o estado aberto', () => {
    render()

    const lojas = headerButton('Lojas / Filiais')
    act(() => lojas.click())
    act(() => headerButton('Lojas / Filiais').click())

    expect(window.localStorage.getItem('pedidos:card:catalogo-lojas')).toBe('1')
    expect(headerButton('Lojas / Filiais').getAttribute('aria-expanded')).toBe('true')
  })

  it('mantém o estado de cada seção separado', () => {
    render()

    act(() => headerButton('Lojas / Filiais').click())

    expect(window.localStorage.getItem('pedidos:card:catalogo-lojas')).toBe('0')
    expect(window.localStorage.getItem('pedidos:card:catalogo-categorias')).toBeNull()
  })
})
