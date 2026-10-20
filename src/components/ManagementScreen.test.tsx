// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManagementScreen } from './ManagementScreen'
import { deleteCalculation, deleteSeller, fetchHistory, fetchSalesRecords } from '../lib/salesStore'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('../lib/salesStore', () => ({
  fetchSellers: vi.fn(async () => [
    { id: 'seller-1', name: 'Ana Souza', is_active: true, created_at: '2026-01-01' },
  ]),
  fetchHistory: vi.fn(async () => []),
  fetchSalesRecords: vi.fn(async () => []),
  deleteCalculation: vi.fn(async () => undefined),
  createSeller: vi.fn(),
  updateSeller: vi.fn(),
  deleteSeller: vi.fn(),
  recordSales: vi.fn(),
}))

const historyEntry = {
  id: 'calc-1',
  store_id: null,
  reference_date: '2026-10-01',
  total_sold: 3289.49,
  effective_base_total: 50000,
  custom_total_base: 50000,
  average_ticket: 3289.49,
  record_count: 1,
  target_achievement_percentage: 6.58,
  top_sale: { id: 'seller-1', name: 'Ana Souza', value: 3289.49 },
  created_at: '2026-10-01T10:00:00.000Z',
  created_by: null,
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

  it('mostra o erro 400 somente ao clicar em "Registrar vendas"', async () => {
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    expect(screenText()).not.toContain('Erro 400')

    const registerButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Registrar vendas'),
    )
    if (!registerButton) throw new Error('botão Registrar vendas não encontrado')

    await act(async () => {
      registerButton.click()
    })

    expect(screenText()).toContain('Erro 400')
    expect(screenText()).toContain('informe um valor numérico')
  })

  it('carrega o lançamento do histórico no formulário ao clicar nele', async () => {
    vi.mocked(fetchHistory).mockResolvedValueOnce([historyEntry])
    vi.mocked(fetchSalesRecords).mockResolvedValueOnce([
      {
        id: 'rec-1',
        calculation_id: 'calc-1',
        seller_id: 'seller-1',
        seller_name: 'Ana Souza',
        amount: 3289.49,
        percentage: 6.58,
        reference_date: '2026-10-01',
        created_at: '2026-10-01T10:00:00.000Z',
        created_by: null,
      },
    ])

    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const historyButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Carregar lançamento de 2026-10-01"]',
    )
    if (!historyButton) throw new Error('lançamento do histórico não encontrado')

    await act(async () => {
      historyButton.click()
    })

    expect(inputByLabel('Valor de Ana Souza').value).toBe('3289,49')
    expect(inputByLabel('Meta de vendas').value).toBe('50000,00')
    expect(inputByLabel('Data de referência').value).toBe('2026-10-01')
  })

  it('exclui um lançamento do histórico', async () => {
    vi.mocked(fetchHistory).mockResolvedValueOnce([historyEntry])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const deleteButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Excluir lançamento de 2026-10-01"]',
    )
    if (!deleteButton) throw new Error('botão de exclusão não encontrado')

    await act(async () => {
      deleteButton.click()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteCalculation).toHaveBeenCalledWith('calc-1')
    confirmSpy.mockRestore()
  })

  it('colapsa o card e mantém o estado ao remontar a tela', async () => {    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const collapseButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Recolher Cálculo de vendas"]',
    )
    if (!collapseButton) throw new Error('botão de colapso não encontrado')

    await act(async () => {
      collapseButton.click()
    })

    expect(container.querySelector('[aria-label="Meta de vendas"]')).toBeNull()
    expect(window.localStorage.getItem('pedidos:card:management-calculo')).toBe('0')

    await act(async () => {
      root.unmount()
    })
    root = createRoot(container)
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    expect(container.querySelector('[aria-label="Meta de vendas"]')).toBeNull()
    expect(
      container.querySelector('[aria-label="Expandir Cálculo de vendas"]'),
    ).not.toBeNull()
  })

  it('pede confirmação antes de excluir um vendedor', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const removeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remover Ana Souza"]',
    )
    if (!removeButton) throw new Error('botão de remoção não encontrado')

    await act(async () => {
      removeButton.click()
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteSeller).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('limpa os valores digitados dos vendedores', async () => {
    await act(async () => {
      root.render(<ManagementScreen />)
    })

    const valueInput = inputByLabel('Valor de Ana Souza')
    await type(valueInput, '3289,49')
    expect(valueInput.value).toBe('3289,49')

    const clearButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Limpar valores dos vendedores"]',
    )
    if (!clearButton) throw new Error('botão de limpar valores não encontrado')

    await act(async () => {
      clearButton.click()
    })

    expect(inputByLabel('Valor de Ana Souza').value).toBe('')
  })
})
