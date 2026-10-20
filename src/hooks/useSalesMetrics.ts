import { useCallback, useState } from 'react'
import {
  buildSalesPayloadFromForm,
  calculateSalesMetrics,
  normalizeSalesPayload,
  SalesPayloadError,
} from '../lib/salesMetrics'
import { newId } from '../lib/utils'
import type { SalesMetricsResult, SalesValidationError } from '../types/sales'

export interface SellerRow {
  uid: string
  name: string
  value: string
}

export function createSellerRow(name = '', value = ''): SellerRow {
  return { uid: newId(), name, value }
}

export function useSalesMetrics() {
  const [meta, setMeta] = useState('')
  const [sellers, setSellers] = useState<SellerRow[]>(() => [createSellerRow(), createSellerRow()])
  const [result, setResult] = useState<SalesMetricsResult | null>(null)
  const [error, setError] = useState<SalesValidationError | null>(null)

  const addSeller = useCallback((): void => {
    setSellers((previous) => [...previous, createSellerRow()])
  }, [])

  const updateSeller = useCallback((uid: string, patch: Partial<Omit<SellerRow, 'uid'>>): void => {
    setSellers((previous) =>
      previous.map((row) => (row.uid === uid ? { ...row, ...patch } : row)),
    )
  }, [])

  const removeSeller = useCallback((uid: string): void => {
    setSellers((previous) => (previous.length > 1 ? previous.filter((row) => row.uid !== uid) : previous))
  }, [])

  const clear = useCallback((): void => {
    setMeta('')
    setSellers([createSellerRow(), createSellerRow()])
    setResult(null)
    setError(null)
  }, [])

  const loadExample = useCallback((): void => {
    setMeta('50000')
    setSellers([
      createSellerRow('Ana Souza', '18500,50'),
      createSellerRow('Bruno Lima', '12750'),
      createSellerRow('Carla Menezes', '9400,75'),
      createSellerRow('Diego Alves', '9350,25'),
    ])
    setResult(null)
    setError(null)
  }, [])

  const process = useCallback((): void => {
    const { payload, error: formError } = buildSalesPayloadFromForm({
      meta,
      rows: sellers.map((row) => ({ name: row.name, value: row.value })),
    })

    if (formError || !payload) {
      setResult(null)
      setError(formError)
      return
    }

    try {
      setResult(calculateSalesMetrics(normalizeSalesPayload(payload)))
      setError(null)
    } catch (err) {
      setResult(null)
      if (err instanceof SalesPayloadError) {
        setError({ status: err.status, message: err.message, details: err.details })
        return
      }
      setError({
        status: 400,
        message: 'Dados inválidos.',
        details: ['Não foi possível processar os dados informados.'],
      })
    }
  }, [sellers, meta])

  return {
    meta,
    setMeta,
    sellers,
    addSeller,
    updateSeller,
    removeSeller,
    result,
    error,
    process,
    clear,
    loadExample,
  }
}
