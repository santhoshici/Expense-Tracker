export type ChartType = 'bar' | 'line' | 'pie' | 'metric_card' | 'table'

export interface SummaryMetrics {
  totalAmount?: number
  trendPercentage?: number
  highestCategory?: string
}

export interface AIAnalyticsResponse {
  explanation: string
  generatedQuery: string
  chartType: ChartType
  chartTitle: string
  xAxisKey: string
  yAxisKey: string
  data: Record<string, any>[]
  summaryMetrics?: SummaryMetrics
}

export interface AgentEvent {
  type: 'agent_state' | 'agent_data' | 'agent_error' | 'done'
  message?: string
  data?: AIAnalyticsResponse
  error?: string
}

export const STANDARD_CATEGORIES = [
  'Food & Dining',
  'Housing',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Travel',
  'Education',
  'Other',
] as const

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number]
