import type { OrderStatus } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Ожидает оплаты",
  PROCESSED: "Обработан",
  PAID: "Оплачен",
  SHIPPED: "Отправлен",
  DELIVERED: "Доставлен",
  RECEIVED: "Получен",
  REFUNDED: "Возврат",
  CANCELLED: "Отменён",
}

const STATUS_CLASSES: Record<OrderStatus, string> = {
  NEW: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  PROCESSED: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  PAID: "bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100",
  SHIPPED: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  DELIVERED:
    "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
  RECEIVED:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  REFUNDED:
    "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100",
  CANCELLED: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
}

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <Badge
      className={cn(STATUS_CLASSES[status], className)}
      variant="secondary"
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export { STATUS_LABELS }
