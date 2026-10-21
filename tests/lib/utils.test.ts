import { describe, expect, it } from 'vitest'
import { parseNumberOrNull } from '../../src/lib/utils'

describe('utils — parseNumberOrNull', () => {
  it('aceita vírgula e ponto decimal', () => {
    expect(parseNumberOrNull('3289,49')).toBe(3289.49)
    expect(parseNumberOrNull('3289.49')).toBe(3289.49)
    expect(parseNumberOrNull('0,5')).toBe(0.5)
    expect(parseNumberOrNull('10')).toBe(10)
  })

  it('aceita separador de milhar e símbolo de moeda', () => {
    expect(parseNumberOrNull('3.289,49')).toBe(3289.49)
    expect(parseNumberOrNull('1.234')).toBe(1234)
    expect(parseNumberOrNull('1.234.567')).toBe(1234567)
    expect(parseNumberOrNull('R$ 3.289,49')).toBe(3289.49)
    expect(parseNumberOrNull(' 3289,49 ')).toBe(3289.49)
  })

  it('devolve null para entradas não numéricas', () => {
    expect(parseNumberOrNull('')).toBeNull()
    expect(parseNumberOrNull('   ')).toBeNull()
    expect(parseNumberOrNull('abc')).toBeNull()
    expect(parseNumberOrNull('-')).toBeNull()
  })

  it('mantém números negativos para o chamador sinalizar', () => {
    expect(parseNumberOrNull('-5')).toBe(-5)
  })
})
