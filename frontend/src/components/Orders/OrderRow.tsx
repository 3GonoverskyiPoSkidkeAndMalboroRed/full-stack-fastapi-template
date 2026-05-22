import { ChevronDown } from "lucide-react"
import { useState } from "react"

import type { OrderPublic } from "@/client"
import { formatPrice } from "@/lib/format"
import { CancelOrderDialog } from "@/components/Orders/CancelOrderDialog"
import { OrderStatusBadge } from "@/components/Orders/OrderStatusBadge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CANCELLABLE_STATUSES = new Set(["NEW", "PROCESSED", "PAID"])

interface OrderRowProps {
  order: OrderPublic
}

function formatDate(dt?: string | null): string {
  if (!dt) return "—"
  try {
    return new Date(dt).toLocaleString("ru-RU")
  } catch {
    return dt
  }
}

export function OrderRow({ order }: OrderRowProps) {
  const [open, setOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const canCancel = CANCELLABLE_STATUSES.has(order.status)

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="text-muted-foreground font-mono text-xs">
            №{order.id.slice(0, 8)}
          </span>
          <span className="text-muted-foreground text-sm">
            {formatDate(order.created_at)}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>
        <span className="font-semibold">
          {formatPrice(Number(order.total))}
        </span>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8"
          tabIndex={-1}
        >
          <span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </Button>
      </button>
      {open && (
        <div className="space-y-3 border-t p-4">
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Получатель: </span>
              {order.recipient_name}
            </div>
            <div>
              <span className="text-muted-foreground">Телефон: </span>
              {order.phone}
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Адрес: </span>
              {order.address}
            </div>
            {order.comment && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Комментарий: </span>
                {order.comment}
              </div>
            )}
            {order.cancellation_reason && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Причина отмены: </span>
                {order.cancellation_reason}
              </div>
            )}
          </div>
          <div className="space-y-1">
            {(order.items ?? []).map((oi) => (
              <div
                key={oi.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {oi.title_snapshot} × {oi.quantity}
                </span>
                <span className="font-medium">
                  {formatPrice(Number(oi.price_snapshot) * oi.quantity)}
                </span>
              </div>
            ))}
          </div>
          {canCancel && (
            <div className="flex justify-end border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
              >
                Отменить заказ
              </Button>
            </div>
          )}
        </div>
      )}
      <CancelOrderDialog
        orderId={order.id}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </div>
  )
}
