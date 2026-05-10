import { useSuspenseQuery } from "@tanstack/react-query"
import { Fragment, Suspense, useState } from "react"

import { ordersReadOrders } from "@/client"
import { OrderStatusSelect } from "@/components/Admin/Orders/OrderStatusSelect"
import { formatPrice } from "@/components/Catalog/ProductCard"
import { OrderStatusBadge } from "@/components/Orders/OrderStatusBadge"
import { PendingOrders } from "@/components/Pending/PendingOrders"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function getAdminOrdersQueryOptions() {
  return {
    queryKey: ["orders", "admin"],
    queryFn: async () =>
      (await ordersReadOrders({ query: { skip: 0, limit: 100 } })).data!,
  }
}

function formatDate(dt?: string | null): string {
  if (!dt) return "—"
  try {
    return new Date(dt).toLocaleString("ru-RU")
  } catch {
    return dt
  }
}

function AdminOrdersTable() {
  const { data } = useSuspenseQuery(getAdminOrdersQueryOptions())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (data.count === 0) {
    return (
      <p className="rounded-md border p-12 text-center text-muted-foreground">
        Заказов пока нет.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№</TableHead>
            <TableHead>Дата</TableHead>
            <TableHead>Получатель</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Управление</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((order) => (
            <Fragment key={order.id}>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  {order.id.slice(0, 8)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(order.created_at)}
                </TableCell>
                <TableCell className="text-sm">
                  <div>{order.recipient_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.phone}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatPrice(Number(order.total))}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <OrderStatusSelect
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedId((id) => (id === order.id ? null : order.id))
                    }
                  >
                    {expandedId === order.id ? "Скрыть" : "Подробнее"}
                  </Button>
                </TableCell>
              </TableRow>
              {expandedId === order.id && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-muted/30">
                    <div className="space-y-2 py-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Адрес: </span>
                        {order.address}
                      </div>
                      {order.comment && (
                        <div>
                          <span className="text-muted-foreground">
                            Комментарий:{" "}
                          </span>
                          {order.comment}
                        </div>
                      )}
                      <div className="space-y-1 pt-2">
                        {(order.items ?? []).map((oi) => (
                          <div
                            key={oi.id}
                            className="flex items-center justify-between"
                          >
                            <span>
                              {oi.title_snapshot} × {oi.quantity}
                            </span>
                            <span className="font-medium">
                              {formatPrice(
                                Number(oi.price_snapshot) * oi.quantity,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function AdminOrdersPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Заказы</h2>
        <p className="text-sm text-muted-foreground">
          Управление статусами заказов
        </p>
      </div>
      <Suspense fallback={<PendingOrders />}>
        <AdminOrdersTable />
      </Suspense>
    </div>
  )
}
