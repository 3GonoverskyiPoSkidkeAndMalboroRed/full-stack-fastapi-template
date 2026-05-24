import { ordersReadOrdersStats } from "@/client"
import type { OrderStatsResponse } from "@/client/types.gen"

export type StatsGroupBy = "hour" | "day" | "month"

export type StatsRange = {
  start: Date
  end: Date
}

export type StatsQueryParams = StatsRange & {
  groupBy: StatsGroupBy
}

/**
 * Берёт локальные year/month/day из Date и помечает их как Europe/Moscow (+03:00).
 * Достаточно для админов, работающих в МСК — точно совпадает с агрегацией на бэке.
 */
function toMoscowIsoStart(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}T00:00:00+03:00`
}

/** Конец диапазона — начало следующего дня (exclusive). */
export function rangeEndIso(end: Date): string {
  const next = new Date(end)
  next.setDate(next.getDate() + 1)
  return toMoscowIsoStart(next)
}

export function rangeStartIso(start: Date): string {
  return toMoscowIsoStart(start)
}

export function getOrdersStatsQueryOptions(params: StatsQueryParams) {
  const start = rangeStartIso(params.start)
  const end = rangeEndIso(params.end)
  return {
    queryKey: ["orders", "stats", { start, end, groupBy: params.groupBy }],
    queryFn: async (): Promise<OrderStatsResponse> => {
      const res = await ordersReadOrdersStats({
        query: { start, end, group_by: params.groupBy },
      })
      return res.data!
    },
  }
}
