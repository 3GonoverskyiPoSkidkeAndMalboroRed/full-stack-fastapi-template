import { useSuspenseQuery } from "@tanstack/react-query"
import { Suspense, useMemo, useState } from "react"

import { StatsAreaChart } from "@/components/Admin/Stats/StatsAreaChart"
import { StatsKpiCards } from "@/components/Admin/Stats/StatsKpiCards"
import {
  DateRangePicker,
  type DateRangeValue,
  type RangePreset,
} from "@/components/Admin/Stats/DateRangePicker"
import {
  getOrdersStatsQueryOptions,
  type StatsGroupBy,
} from "@/components/Admin/Stats/useOrdersStatsQuery"

const MS_DAY = 1000 * 60 * 60 * 24

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date())
  d.setDate(d.getDate() - n)
  return d
}

function monthsAgo(n: number): Date {
  const d = startOfDay(new Date())
  d.setMonth(d.getMonth() - n)
  return d
}

const today = () => startOfDay(new Date())

const PERIOD_PRESETS: RangePreset[] = [
  {
    key: "today",
    label: "Сегодня",
    range: () => ({ from: today(), to: today() }),
  },
  {
    key: "7d",
    label: "7 дней",
    range: () => ({ from: daysAgo(6), to: today() }),
  },
  {
    key: "30d",
    label: "Месяц",
    range: () => ({ from: daysAgo(29), to: today() }),
  },
  {
    key: "6m",
    label: "Полгода",
    range: () => ({ from: monthsAgo(6), to: today() }),
  },
  {
    key: "1y",
    label: "Год",
    range: () => ({ from: monthsAgo(12), to: today() }),
  },
]

const HOURLY_PRESETS: RangePreset[] = [
  {
    key: "today",
    label: "Сегодня",
    range: () => ({ from: today(), to: today() }),
  },
  {
    key: "yesterday",
    label: "Вчера",
    range: () => ({ from: daysAgo(1), to: daysAgo(1) }),
  },
  {
    key: "7d",
    label: "7 дней",
    range: () => ({ from: daysAgo(6), to: today() }),
  },
  {
    key: "14d",
    label: "14 дней",
    range: () => ({ from: daysAgo(13), to: today() }),
  },
  {
    key: "31d",
    label: "31 день",
    range: () => ({ from: daysAgo(30), to: today() }),
  },
]

function rangeSpanDays(range: DateRangeValue): number {
  const ms = startOfDay(range.to).getTime() - startOfDay(range.from).getTime()
  return Math.round(ms / MS_DAY) + 1
}

function chooseGroupBy(range: DateRangeValue): StatsGroupBy {
  const days = rangeSpanDays(range)
  if (days <= 2) return "hour"
  if (days <= 90) return "day"
  return "month"
}

function ChartSection({
  range,
  groupBy,
}: {
  range: DateRangeValue
  groupBy: StatsGroupBy
}) {
  const { data } = useSuspenseQuery(
    getOrdersStatsQueryOptions({
      start: range.from,
      end: range.to,
      groupBy,
    }),
  )
  return (
    <div className="flex flex-col gap-4">
      <StatsKpiCards summary={data.summary} />
      <div className="border-ink rounded-none border p-4">
        <StatsAreaChart points={data.points} groupBy={groupBy} />
      </div>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="border-ink h-[88px] animate-pulse rounded-none border bg-neutral-100"
          />
        ))}
      </div>
      <div className="border-ink h-[280px] animate-pulse rounded-none border bg-neutral-100" />
    </div>
  )
}

function SectionHeader({
  caption,
  title,
  subtitle,
  control,
}: {
  caption: string
  title: string
  subtitle?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mono text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
          {caption}
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
        )}
      </div>
      {control}
    </div>
  )
}

export function OrdersStatsPanel() {
  const [periodRange, setPeriodRange] = useState<DateRangeValue>(() => ({
    from: daysAgo(29),
    to: today(),
  }))
  const [hourlyRange, setHourlyRange] = useState<DateRangeValue>(() => ({
    from: daysAgo(6),
    to: today(),
  }))

  const periodGroupBy = useMemo(() => chooseGroupBy(periodRange), [periodRange])

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5">
        <SectionHeader
          caption="Раздел / Динамика"
          title="Заказы по периоду"
          subtitle={`Группировка: ${
            periodGroupBy === "hour"
              ? "по часам"
              : periodGroupBy === "day"
                ? "по дням"
                : "по месяцам"
          }`}
          control={
            <DateRangePicker
              value={periodRange}
              onChange={setPeriodRange}
              presets={PERIOD_PRESETS}
            />
          }
        />
        <Suspense fallback={<SectionSkeleton />}>
          <ChartSection range={periodRange} groupBy={periodGroupBy} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-5">
        <SectionHeader
          caption="Раздел / Часы пик"
          title="Заказы по часам"
          subtitle="Группировка по часам календаря. Диапазон — до 31 дня."
          control={
            <DateRangePicker
              value={hourlyRange}
              onChange={setHourlyRange}
              presets={HOURLY_PRESETS}
              maxRangeDays={31}
            />
          }
        />
        <Suspense fallback={<SectionSkeleton />}>
          <ChartSection range={hourlyRange} groupBy="hour" />
        </Suspense>
      </section>
    </div>
  )
}
