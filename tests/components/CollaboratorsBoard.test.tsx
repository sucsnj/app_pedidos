// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollaboratorsBoard } from '../../src/components/CollaboratorsBoard'

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.eq = () => builder
      builder.then = (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
      return builder
    },
  },
}))

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
      <CollaboratorsBoard
        stores={[
          {
            id: 'store-1',
            code: 'L1',
            name: 'Loja Central',
            is_active: true,
            created_at: '2026-01-01',
          },
        ]}
        currentUserId="user-1"
        onFlash={vi.fn()}
      />,
    )
  })
}

function headerButton(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text),
  )
  if (!button) throw new Error(`card "${text}" não encontrado`)
  return button
}

describe('CollaboratorsBoard — colapso persistido', () => {
  it('mantém os cards colapsados ao remontar', () => {
    render()

    const form = headerButton('Cadastrar Novo Colaborador')
    expect(form.getAttribute('aria-expanded')).toBe('true')

    act(() => form.click())
    expect(form.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem('pedidos:card:colaboradores-form')).toBe('0')

    act(() => root.unmount())
    root = createRoot(container)
    render()

    expect(headerButton('Cadastrar Novo Colaborador').getAttribute('aria-expanded')).toBe('false')
  })
})
