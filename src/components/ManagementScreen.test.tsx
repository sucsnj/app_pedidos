// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManagementScreen } from './ManagementScreen'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('../lib/salesStore', () => ({
  fetchSellers: vi.fn(async () => [
    { id: 'seller-1', name: 'Ana Souza', is_active: true, created_at: '2026-01-01' },
  ]),
  fetchHistory: vi.fn(async () => []),
  createSeller: vi.fn(),
  deleteSeller: vi.fn(),
  recordSales: vi.fn(),
}))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function inputByLabel(label: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)
  if (!element) throw new Error(`input não encontrado: ${label}`)
  return element
}

async function type(element: HTMLInputElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  await act(async () => {
    setter?.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function screenText(): string {
  return (container.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')
}

describe('ManagementScreen — digitação do valor do vendedor', () => {
  it('aceita "3289,49" e limpa o erro de validação', async () => {
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const valueInput = inputByLabel('Valor de Ana Souza')
    await type(valueInput, '3289,49')

    expect(valueInput.value).toBe('3289,49')
    expect(screenText()).not.toContain('informe um valor numérico')
    expect(screenText()).toContain('R$ 3.289,49')
  })

  it('aceita "3289.49" e "3.289,49"', async () => {
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const valueInput = inputByLabel('Valor de Ana Souza')
    await type(valueInput, '3289.49')
    expect(screenText()).toContain('R$ 3.289,49')

    await type(valueInput, '3.289,49')
    expect(screenText()).toContain('R$ 3.289,49')
  })

  it('não acusa erro enquanto o valor está em branco', async () => {
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    expect(screenText()).not.toContain('Erro 400')
  })
})
