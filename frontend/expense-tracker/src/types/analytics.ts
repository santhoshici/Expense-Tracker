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

// Must stay in sync with backend/ml/categorizer.py STANDARD_CATEGORIES.
export const STANDARD_CATEGORIES = [
  'Food',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Transport',
  'Investment',
  'Salary',
] as const
