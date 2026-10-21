import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSalesPayloadFromForm,
  calculateSalesMetrics,
  normalizeSalesPayload,
} from '../lib/salesMetrics'
import { createSeller, deactivateSeller, deleteCalculation, fetchHistory, fetchSellers, fetchSalesRecords, recordSales, updateSeller } from '../lib/salesStore'
import { isOffline, isOfflineError } from '../lib/offlineQueue'
import { getErrorMessage, parseNumberOrNull } from '../lib/utils'
import type { Seller, SalesCalculation } from '../types/database'
import type { FlashKind } from '../types/app'
import type { SalesMetricsResult } from '../types/sales'

export interface SalesManagementParams {
  storeId?: string | null
  /** A loja já foi resolvida? Enquanto não, nada é carregado (evita ler todas as lojas). */
  ready?: boolean
  notify: (message: string, kind?: FlashKind) => void
}

export interface ManagementError {
  status: number | null
  message: string
  details: string[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Formata um número para o campo de texto (pt-BR, 2 casas). */
function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(2).replace('.', ',')
}

export function useSalesManagement({
  storeId = null,
  ready = true,
  notify,
}: SalesManagementParams) {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [meta, setMetaState] = useState('')
  const [referenceDate, setReferenceDateState] = useState(today())
  const [history, setHistory] = useState<SalesCalculation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ManagementError | null>(null)
  const [registered, setRegistered] = useState(false)
  const [formStoreId, setFormStoreId] = useState(storeId)

  // Trocar de loja zera o formulário: valores, meta e estado de registro
  // pertencem à loja anterior (reset no render, antes de pintar a tela).
  if (formStoreId !== storeId) {
    setFormStoreId(storeId)
    setSellers([])
    setHistory([])
    setValues({})
    setMetaState('')
    setRegistered(false)
    setError(null)
  }

  const load = useCallback(async (): Promise<void> => {
    const [sellersData, historyData] = await Promise.all([
      fetchSellers(storeId),
      fetchHistory(20, storeId),
    ])
    setSellers(sellersData)
    setHistory(historyData)
  }, [storeId])

  useEffect(() => {
    if (!ready) return
    if (!storeId) {
      // Sem loja definida (ainda não resolvida ou usuário sem loja) nada é
      // buscado — nenhuma consulta sem filtro escopo.
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .catch((err) => {
        if (cancelled) return
        setError({
          status: null,
          message: isOffline() || isOfflineError(err)
            ? 'Sem conexão — não foi possível carregar vendedores e histórico do banco.'
            : getErrorMessage(err),
          details: [],
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load, ready])

  const addSeller = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim()
      if (trimmed === '') {
        setError({ status: 400, message: 'Informe o nome do vendedor.', details: [] })
        return false
      }
      setSaving(true)
      setError(null)
      try {
        const seller = await createSeller(trimmed, storeId)
        setSellers((previous) =>
          [...previous, seller].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        )
        notify('Vendedor cadastrado.', 'success')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify, storeId],
  )

  const renameSeller = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = name.trim()
      if (trimmed === '') {
        setError({ status: 400, message: 'Informe o nome do vendedor.', details: [] })
        return false
      }
      setSaving(true)
      setError(null)
      try {
        const updated = await updateSeller(id, trimmed)
        setSellers((previous) =>
          previous
            .map((seller) => (seller.id === id ? updated : seller))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        )
        notify('Vendedor atualizado.', 'success')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

  /** Vincula um vendedor "global" (sem loja) à loja selecionada. */
  const bindSeller = useCallback(
    async (id: string): Promise<boolean> => {
      const seller = sellers.find((entry) => entry.id === id)
      if (!seller || !storeId) return false
      setSaving(true)
      setError(null)
      try {
        const updated = await updateSeller(id, seller.name, storeId)
        setSellers((previous) =>
          previous.map((entry) => (entry.id === id ? updated : entry)),
        )
        notify('Vendedor vinculado à loja.', 'success')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [sellers, storeId, notify],
  )

  const removeSeller = useCallback(
    async (id: string): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        await deactivateSeller(id)
        setSellers((previous) => previous.filter((seller) => seller.id !== id))
        setValues((previous) => {
          const next = { ...previous }
          delete next[id]
          return next
        })
        notify('Vendedor desativado — o histórico foi preservado.', 'success')
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

  const setValue = useCallback((sellerId: string, value: string): void => {
    setValues((previous) => ({ ...previous, [sellerId]: value }))
    setRegistered(false)
  }, [])

  /** Limpa todos os valores digitados (mantém os vendedores cadastrados). */
  const clearValues = useCallback((): void => {
    setValues({})
    setRegistered(false)
  }, [])

  const setMeta = useCallback((value: string): void => {
    setMetaState(value)
    setRegistered(false)
  }, [])

  const setReferenceDate = useCallback((value: string): void => {
    setReferenceDateState(value)
    setRegistered(false)
  }, [])

  /** Carrega um lançamento do histórico no formulário (valores, meta e data). */
  const loadHistory = useCallback(
    async (entry: SalesCalculation): Promise<boolean> => {
      setSaving(true)
      setError(null)
      try {
        const records = await fetchSalesRecords(entry.id)
        const next: Record<string, string> = {}
        for (const record of records) {
          next[record.seller_id] = formatAmountInput(Number(record.amount))
        }
        setValues(next)
        setReferenceDate(entry.reference_date)
        setMeta(
          entry.custom_total_base === null
            ? ''
            : formatAmountInput(Number(entry.custom_total_base)),
        )
        notify('Histórico carregado no formulário.', 'success')
        return true
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
        return false
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

  /** Exclui uma consolidação do histórico (as vendas vinculadas caem em cascata). */
  const removeHistory = useCallback(
    async (id: string): Promise<void> => {
      setSaving(true)
      setError(null)
      try {
        await deleteCalculation(id)
        setHistory((previous) => previous.filter((entry) => entry.id !== id))
        notify('Lançamento excluído do histórico.', 'success')
      } catch (err) {
        const message = getErrorMessage(err)
        setError({ status: null, message, details: [] })
        notify(message, 'error')
      } finally {
        setSaving(false)
      }
    },
    [notify],
  )

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
      const validation: ManagementError = {
        status: 400,
        message: 'Dados inválidos.',
        details: formError.details,
      }
      setError(validation)
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
      setError({ status: 400, message, details: [] })
      notify(message, 'error')
      return false
    }

    const hasMeta = result.summary.customTotalBase !== null && result.summary.customTotalBase > 0
    if (!hasMeta) {
      const confirmed = window.confirm(
        'A meta (base de cálculo) não foi informada. Registrar mesmo assim? O cálculo usará a soma das vendas como base.',
      )
      if (!confirmed) return false
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
      setRegistered(true)
      setHistory(await fetchHistory(20, storeId))
      const zeroed = filled.filter((entry) => entry.amount === 0)
      if (zeroed.length > 0) {
        // Vendedor com 0,00 é permitido (registra "sem vendas" no período) —
        // mas o usuário é avisado para não confundir com esquecimento.
        notify(
          `Vendas registradas — ${zeroed.length} vendedor(es) sem vendas no período (0,00).`,
          'info',
        )
      } else {
        notify('Vendas registradas — histórico atualizado.', 'success')
      }
      return true
    } catch (err) {
      const message = getErrorMessage(err)
      setError({ status: null, message, details: [] })
      notify(message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }, [formError, result, sellers, values, storeId, referenceDate, notify])

  const hasValues = Object.values(values).some((value) => value.trim() !== '')

  return {
    sellers,
    values,
    setValue,
    clearValues,
    hasValues,
    registered,
    meta,
    setMeta,
    referenceDate,
    setReferenceDate,
    history,
    loading,
    saving,
    error,
    result,
    addSeller,
    renameSeller,
    bindSeller,
    removeSeller,
    loadHistory,
    removeHistory,
    register,
    reload: load,
  }
}
