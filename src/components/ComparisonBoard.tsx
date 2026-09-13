import { useMemo } from 'react'
import {
  ArrowRightLeft,
  Award,
  BarChart3,
  ClipboardList,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { CountedItem, LastOrderData, TopProductRow } from '../types/app'
import { EmptyState } from './ui'

export type { TopProductRow }

interface ComparisonBoardProps {
  storeName: string
  currentItems: CountedItem[]
  lastOrder: LastOrderData | null
  monthOrders: number
  topProduct: string
  weekVariationPct: number | null
  topProducts: TopProductRow[]
}

interface ComparisonRow {
  label: string
  currentQty: number
  previousQty: number
}

function itemLabel(item: CountedItem): string {
  return item.product.name + (item.variation.name ? ` (${item.variation.name})` : '')
}

export function ComparisonBoard({
  storeName,
  currentItems,
  lastOrder,
  monthOrders,
  topProduct,
  weekVariationPct,
  topProducts,
}: ComparisonBoardProps) {
  const rows = useMemo<ComparisonRow[]>(() => {
    const map = new Map<string, ComparisonRow>()
    for (const item of currentItems) {
      if (item.quantity <= 0) continue
      map.set(item.key, {
        label: itemLabel(item),
        currentQty: item.quantity,
        previousQty: 0,
      })
    }
    for (const item of lastOrder?.items ?? []) {
      const existing = map.get(item.key)
      map.set(item.key, {
        label: existing?.label ?? itemLabel(item),
        currentQty: existing?.currentQty ?? 0,
        previousQty: item.quantity,
      })
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [currentItems, lastOrder])

  const maxTopQty = topProducts[0]?.quantity ?? 1

  if (rows.length === 0 && topProducts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-gray-500">
          📊 Comparativo & Relatórios
        </h2>
        <EmptyState>
          <p className="font-semibold">Nenhum dado para comparar ainda.</p>
          <p className="mt-1">
            Complete a contagem e conclua pedidos para {storeName || 'a loja'} gerarem histórico.
          </p>
        </EmptyState>
      </div>
    )
  }

  const pctValue =
    weekVariationPct === null ? '—' : `${weekVariationPct > 0 ? '+' : ''}${weekVariationPct}%`
  const pctPositive = weekVariationPct === null ? null : weekVariationPct >= 0

  return (
    <div className="space-y-4">
      <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-gray-500">
        📊 Comparativo & Relatórios
      </h2>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Pedidos no Mês
            </p>
            <ClipboardList className="h-5 w-5 text-wine-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-wine-700">
            {monthOrders}
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Mais Solicitado
            </p>
            <Award className="h-5 w-5 text-gold-500" />
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-bold text-gray-800">{topProduct}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Vol. vs Semana Anterior
            </p>
            {pctPositive === null ? (
              <ArrowRightLeft className="h-5 w-5 text-gray-400" />
            ) : pctPositive ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <p
            className={`mt-2 text-3xl font-extrabold tabular-nums ${
              pctPositive === null
                ? 'text-gray-400'
                : pctPositive
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}
          >
            {pctValue}
          </p>
        </section>
      </div>

      {/* Top produtos */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-wine-600" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
            Top Produtos · últimos 30 dias
          </h3>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">Sem movimentação nos últimos 30 dias.</p>
        ) : (
          <ul className="space-y-3">
            {topProducts.map((item, index) => {
              const width = Math.max(4, Math.round((item.quantity / maxTopQty) * 100))
              return (
                <li key={item.key} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-sm font-extrabold tabular-nums text-gray-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{item.label}</p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-wine-700 to-gold-400 transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-wine-100 px-2.5 py-1 text-sm font-bold tabular-nums text-wine-700">
                    {item.quantity}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Tabela comparativa */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
            Atual vs. Anterior
          </h3>
          <p className="text-xs text-gray-500">
            {storeName || 'Loja'} · pedido atual contra o último concluído
            {lastOrder ? ` (${lastOrder.totalItems} un)` : ''}
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState>
              <p className="font-semibold">Sem itens para comparar.</p>
              <p className="mt-1">O pedido atual ainda não possui quantidades.</p>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-wine-700 text-left text-xs font-bold uppercase tracking-wide text-white">
                  <th className="px-4 py-2.5">Produto / Variação</th>
                  <th className="px-3 py-2.5 text-center">Atual</th>
                  <th className="px-3 py-2.5 text-center">Anterior</th>
                  <th className="px-3 py-2.5 text-center">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const diff = row.currentQty - row.previousQty
                  const diffClass =
                    diff > 0
                      ? 'bg-green-50 text-green-700'
                      : diff < 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                  return (
                    <tr key={row.label}>
                      <td className="min-w-0 max-w-52 truncate px-4 py-2.5 font-medium text-gray-800">
                        {row.label}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-wine-700">
                        {row.currentQty}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">
                        {row.previousQty}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-lg px-2 py-1 font-bold tabular-nums ${diffClass}`}
                        >
                          {diff > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : diff < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5" />
                          ) : null}
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}