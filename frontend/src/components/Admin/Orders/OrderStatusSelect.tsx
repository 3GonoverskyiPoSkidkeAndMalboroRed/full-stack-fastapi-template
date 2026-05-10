import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type OrderStatus, ordersUpdateOrderStatus } from "@/client"
import { STATUS_LABELS } from "@/components/Orders/OrderStatusBadge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: "PROCESSED",
  PROCESSED: "PAID",
  PAID: "SHIPPED",
  SHIPPED: "DELIVERED",
}

interface OrderStatusSelectProps {
  orderId: string
  currentStatus: OrderStatus
}

export function OrderStatusSelect({
  orderId,
  currentStatus,
}: OrderStatusSelectProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (newStatus: OrderStatus) =>
      ordersUpdateOrderStatus({
        path: { id: orderId },
        body: { status: newStatus },
      }),
    onSuccess: () => {
      showSuccessToast("Статус обновлён")
      queryClient.invalidateQueries({ queryKey: ["orders", "admin"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const next = NEXT_STATUS[currentStatus]

  if (!next) {
    return (
      <span className="text-sm text-muted-foreground">Финальный статус</span>
    )
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={(value) => mutation.mutate(value as OrderStatus)}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={currentStatus} disabled>
          {STATUS_LABELS[currentStatus]}
        </SelectItem>
        <SelectItem value={next}>→ {STATUS_LABELS[next]}</SelectItem>
      </SelectContent>
    </Select>
  )
}
