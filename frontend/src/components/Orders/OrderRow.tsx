import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

import {
  type OrderPublic,
  ordersReceiveOrder,
  ordersRefundOrder,
} from "@/client"
import { CancelOrderDialog } from "@/components/Orders/CancelOrderDialog"
import { OrderStatusBadge } from "@/components/Orders/OrderStatusBadge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const REFUND_WINDOW_DAYS = 14

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

function withinRefundWindow(receivedAt?: string | null): boolean {
  if (!receivedAt) return false
  const elapsed = Date.now() - new Date(receivedAt).getTime()
  return elapsed <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export function OrderRow({ order }: OrderRowProps) {
  const [open, setOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const canPay = order.status === "NEW"
  const canCancel = order.status === "NEW"
  const canReceive = order.status === "DELIVERED"
  const canRefund =
    order.status === "RECEIVED" && withinRefundWindow(order.received_at)

  const receiveMutation = useMutation({
    mutationFn: () => ordersReceiveOrder({ path: { id: order.id } }),
    onSuccess: () => {
      showSuccessToast("Получение подтверждено")
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const refundMutation = useMutation({
    mutationFn: () => ordersRefundOrder({ path: { id: order.id } }),
    onSuccess: () => {
      showSuccessToast("Средства возвращены на карту")
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: handleError.bind(showErrorToast),
  })

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
            {order.card_last4 && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Оплата: </span>
                {order.card_brand} •••• {order.card_last4}
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
          {(canPay || canCancel || canReceive || canRefund) && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {canReceive && (
                <LoadingButton
                  type="button"
                  size="sm"
                  loading={receiveMutation.isPending}
                  onClick={() => receiveMutation.mutate()}
                >
                  Подтвердить получение
                </LoadingButton>
              )}
              {canRefund && (
                <LoadingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={refundMutation.isPending}
                  onClick={() => refundMutation.mutate()}
                >
                  Вернуть средства
                </LoadingButton>
              )}
              {canPay && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/pay/$orderId",
                      params: { orderId: order.id },
                    })
                  }
                >
                  Оплатить
                </Button>
              )}
              {canCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(true)}
                >
                  Отменить заказ
                </Button>
              )}
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
