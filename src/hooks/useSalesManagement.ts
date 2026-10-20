import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSalesPayloadFromForm,
  calculateSalesMetrics,
  normalizeSalesPayload,
} from '../lib/salesMetrics'
import { createSeller, deleteSeller, fetchHistory, fetchSellers, recordSales } from '../lib/salesStore'
import { getErrorMessage, parseNumberOrNull } from '../lib/utils'
import type { Seller, SalesCalculation } from '../types/database'
import type { FlashKind } from '../types/app'
import type { SalesMetricsResult } from '../types/sales'

export interface SalesManagementParams {
  storeId?: string | null
  notify: (message: string, kind?: FlashKind) => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useSalesManagement({ storeId = null, notify }: SalesManagementParams) {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [meta, setMeta] = useState('')
  const [referenceDate, setReferenceDate] = useState(today())
  const [history, setHistory] = useState<SalesCalculation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const [sellersData, historyData] = await Promise.all([fetchSellers(), fetchHistory()])
    setSellers(sellersData)
    setHistory(historyData)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const addSeller = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim()
      if (trimmed === '') {
        setError('Informe o nome do vendedor.')
        return false
      }
      setSaving(true)
      setError(null)
      try {
        const seller = await createSeller(trimmed)
        setSellers((previous) =>
          [...previous, seller].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        )
        notify('Vendedor cadastrado.', 'success')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        setError(message)
        notify(message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

  const removeSeller = useCallback(
    async (id: string): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        await deleteSeller(id)
        setSellers((previous) => previous.filter((seller) => seller.id !== id))
        setValues((previous) => {
          const next = { ...previous }
          delete next[id]
          return next
        })
        notify('Vendedor removido.', 'success')
      } catch (err) {
        const message = getErrorMessage(err)
        setError(message)
        notify(message, 'error')
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

  const setValue = useCallback((sellerId: string, value: string): void => {
    setValues((previous) => ({ ...previous, [sellerId]: value }))
  }, [])

  const { payload, error: formError } = useMemo(
    () =>
      buildSalesPayloadFromForm({
        meta,
        rows: sellers.map((seller) => ({ name: seller.name, value: values[seller.id] ?? '' })),
      }),
    [meta, sellers, values],
  )

  const result = useMemo<SalesMetricsResult | null>(() => {
    if (!payload) return null
    try {
      return calculateSalesMetrics(normalizeSalesPayload(payload))
    } catch {
      return null
    }
  }, [payload])

  const register = useCallback(async (): Promise<boolean> => {
    if (formError) {
      notify('Corrija os campos destacados antes de registrar.', 'error')
      return false
    }
    if (!result) return false

    const filled = sellers
      .map((seller) => ({ seller, amount: parseNumberOrNull(values[seller.id] ?? '') }))
      .filter(
        (entry): entry is { seller: Seller; amount: number } =>
          entry.amount !== null && entry.amount >= 0,
      )

    if (filled.length === 0) {
      const message = 'Informe o valor de ao menos um vendedor.'
      setError(message)
      notify(message, 'error')
      return false
    }

    setSaving(true)
    setError(null)
    try {
      await recordSales({
        storeId,
        referenceDate,
        summary: result.summary,
        items: filled.map((entry, index) => ({
          sellerId: entry.seller.id,
          sellerName: entry.seller.name,
          amount: entry.amount,
          percentage: result.salesReport[index]?.percentage ?? 0,
        })),
      })
      setValues({})
      setHistory(await fetchHistory())
      notify('Vendas registradas — histórico atualizado.', 'success')
      return true
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      notify(message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [formError, result, sellers, values, storeId, referenceDate, notify])

  return {
    sellers,
    values,
    setValue,
    meta,
    setMeta,
    referenceDate,
    setReferenceDate,
    history,
    loading,
    saving,
    error,
    formError,
    result,
    addSeller,
    removeSeller,
    register,
    reload: load,
  }
}
