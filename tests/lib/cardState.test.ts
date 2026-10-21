// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { readCardIdSet, readCardState, writeCardIdSet, writeCardState } from '../../src/lib/cardState'

describe('cardState — persistência no navegador', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('grava e lê o estado aberto/fechado de um card', () => {
    writeCardState('catalogo-lojas', false)
    expect(window.localStorage.getItem('pedidos:card:catalogo-lojas')).toBe('0')
    expect(readCardState('catalogo-lojas', true)).toBe(false)

    writeCardState('catalogo-lojas', true)
    expect(readCardState('catalogo-lojas', false)).toBe(true)
  })

  it('usa o valor padrão quando não há estado salvo', () => {
    expect(readCardState('inexistente', true)).toBe(true)
    expect(readCardState('inexistente', false)).toBe(false)
  })

  it('grava e lê um conjunto de ids (categorias colapsadas)', () => {
    writeCardIdSet('contagem-categorias', ['c1', 'c2'])
    expect(readCardIdSet('contagem-categorias')).toEqual(['c1', 'c2'])
  })

  it('ignora conteúdo inválido no storage', () => {
    window.localStorage.setItem('pedidos:card:contagem-categorias', 'nao-e-json')
    expect(readCardIdSet('contagem-categorias')).toEqual([])

    window.localStorage.setItem('pedidos:card:contagem-categorias', '{"a":1}')
    expect(readCardIdSet('contagem-categorias')).toEqual([])
  })
})
