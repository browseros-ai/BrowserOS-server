/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Stub implementation for performance trace parsing
 * TODO: Implement actual trace processing when chrome-devtools-frontend is fixed
 */

export type InsightName = string

export interface TraceResult {
  // Stub type
  data?: unknown
  error?: string
}

export function getInsightOutput(
  _result: TraceResult,
  _insightName: InsightName,
): { output: string } | { error: string } {
  return { error: 'Performance trace analysis is currently disabled' }
}

export function getTraceSummary(_result: TraceResult): string {
  return 'Performance trace summary is currently disabled'
}

export async function parseRawTraceBuffer(
  _buffer: Buffer,
): Promise<TraceResult> {
  return { error: 'Performance trace parsing is currently disabled' }
}

export function traceResultIsSuccess(result: TraceResult): boolean {
  return !result.error
}
