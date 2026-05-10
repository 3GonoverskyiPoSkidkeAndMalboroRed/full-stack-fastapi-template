import { useSuspenseQuery } from "@tanstack/react-query"

import { ordersReadOrders } from "@/client"
import { OrderRow } from "@/components/Orders/OrderRow"

export function getOrdersQueryOptions() {
  return {
    queryKey: ["orders"],
    queryFn: async () => (await ordersReadOrders()).data!,
  }
}

export function OrdersList() {
  const { data } = useSuspenseQuery(getOrdersQueryOptions())

  if (data.count === 0) {
    return (
      <p className="rounded-md border p-12 text-center text-muted-foreground">
        У вас пока нет заказов.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {data.data.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </div>
  )
}
