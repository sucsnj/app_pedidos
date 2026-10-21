// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CollapsibleCard } from '../../src/components/CollapsibleCard'

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
      <CollapsibleCard storageKey="teste" title="Cartão">
        <p>conteúdo</p>
      </CollapsibleCard>,
    )
  })
}

function header(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button')
  if (!button) throw new Error('cabeçalho não encontrado')
  return button
}

describe('CollapsibleCard', () => {
  it('abre por padrão e mostra o conteúdo', () => {
    render()

    expect(container.textContent).toContain('conteúdo')
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('colapsa e expande ao clicar no cabeçalho', () => {
    render()

    act(() => header().click())
    expect(container.textContent).not.toContain('conteúdo')
    expect(header().getAttribute('aria-expanded')).toBe('false')

    act(() => header().click())
    expect(container.textContent).toContain('conteúdo')
  })

  it('guarda o último estado no navegador', () => {
    render()

    act(() => header().click())
    expect(window.localStorage.getItem('pedidos:card:teste')).toBe('0')

    act(() => header().click())
    expect(window.localStorage.getItem('pedidos:card:teste')).toBe('1')
  })

  it('restaura o estado salvo ao montar', () => {
    window.localStorage.setItem('pedidos:card:teste', '0')

    render()

    expect(container.textContent).not.toContain('conteúdo')
  })
})
