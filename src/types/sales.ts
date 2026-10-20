export interface SalesItemInput {
  id: string | number
  name: string
  value: number
}

export interface SalesPayload {
  customTotalBase: number | null
  sales: SalesItemInput[]
}

export interface SalesTopSale {
  id: string | number
  name: string
  value: number
}

export interface SalesSummary {
  totalSold: number
  effectiveBaseTotal: number
  customTotalBase: number | null
  averageTicket: number
  count: number
  targetAchievementPercentage: number
  topSale: SalesTopSale | null
}

export type SalesReportItem = SalesItemInput & { percentage: number }

export interface SalesMetricsResult {
  summary: SalesSummary
  salesReport: SalesReportItem[]
}

export interface SalesValidationError {
  status: 400
  message: string
  details: string[]
}
