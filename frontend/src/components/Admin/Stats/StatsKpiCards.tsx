import type { OrderStatsSummary } from "@/client/types.gen"
import { formatPrice } from "@/lib/format"

type StatsKpiCardsProps = {
  summary: OrderStatsSummary
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-ink rounded-none border p-4">
      <div className="mono text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

const numberFormatter = new Intl.NumberFormat("ru-RU")

export function StatsKpiCards({ summary }: StatsKpiCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <KpiCard label="Заказов" value={numberFormatter.format(summary.count)} />
      <KpiCard label="Сумма" value={formatPrice(summary.total)} />
      <KpiCard label="Средний чек" value={formatPrice(summary.average)} />
    </div>
  )
}
