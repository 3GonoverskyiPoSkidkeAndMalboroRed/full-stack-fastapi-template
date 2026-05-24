import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { OrderStatsBucket } from "@/client/types.gen"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatPrice } from "@/lib/format"

import type { StatsGroupBy } from "./useOrdersStatsQuery"

type StatsAreaChartProps = {
  points: OrderStatsBucket[]
  groupBy: StatsGroupBy
}

type Metric = "count" | "total"

const CHART_CONFIG: ChartConfig = {
  count: {
    label: " Заказов",
    color: "var(--chart-1)",
  },
  total: {
    label: " Сумма",
    color: "var(--chart-2)",
  },
}

function bucketDate(bucket: string): Date {
  return new Date(bucket)
}

function xLabel(bucket: string, groupBy: StatsGroupBy): string {
  const d = bucketDate(bucket)
  if (groupBy === "hour") return format(d, "HH:00", { locale: ru })
  if (groupBy === "day") return format(d, "dd.MM", { locale: ru })
  return format(d, "LLL yyyy", { locale: ru })
}

function tooltipLabel(bucket: string, groupBy: StatsGroupBy): string {
  const d = bucketDate(bucket)
  if (groupBy === "hour") return format(d, "d MMM, HH:00", { locale: ru })
  if (groupBy === "day") return format(d, "d MMMM yyyy", { locale: ru })
  return format(d, "LLLL yyyy", { locale: ru })
}

export function StatsAreaChart({ points, groupBy }: StatsAreaChartProps) {
  const data = points.map((p) => ({
    bucket: p.bucket,
    count: p.count,
    total: Number(p.total),
    average: Number(p.average),
  }))

  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-[16/7] w-full">
      <AreaChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
        <defs>
          {(Object.keys(CHART_CONFIG) as Metric[]).map((key) => (
            <linearGradient
              id={`stats-fill-${key}`}
              key={key}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={`var(--color-${key})`}
                stopOpacity={0.55}
              />
              <stop
                offset="95%"
                stopColor={`var(--color-${key})`}
                stopOpacity={0.05}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(value: string) => xLabel(value, groupBy)}
        />
        <YAxis
          yAxisId="count"
          orientation="left"
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="total"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) => formatPrice(v)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => tooltipLabel(String(value), groupBy)}
              formatter={(value, name) => {
                const formatted =
                  name === "total" ? formatPrice(Number(value)) : String(value)
                return [
                  formatted,
                  String(CHART_CONFIG[name as Metric]?.label ?? name),
                ]
              }}
            />
          }
        />
        <Area
          yAxisId="count"
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          fill="url(#stats-fill-count)"
          strokeWidth={2}
        />
        <Area
          yAxisId="total"
          type="monotone"
          dataKey="total"
          stroke="var(--color-total)"
          fill="url(#stats-fill-total)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
