import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Suspense } from "react"

import { ordersReadOrder } from "@/client"
import { PaymentForm } from "@/components/Checkout/PaymentForm"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/format"

export const Route = createFileRoute("/_authed/pay/$orderId")({
  component: PayPage,
  head: () => ({ meta: [{ title: "Оплата заказа — РЕЕСТР13" }] }),
})

function PayContent() {
  const { orderId } = Route.useParams()
  const { data: order } = useSuspenseQuery({
    queryKey: ["orders", orderId],
    queryFn: async () =>
      (await ordersReadOrder({ path: { id: orderId } })).data!,
  })

  if (order.status !== "NEW") {
    return (
      <div className="space-y-3 rounded-md border p-6 text-center">
        <p>Этот заказ уже оплачен или недоступен для оплаты.</p>
        <Link to="/account" className="nav-link">
          Перейти в кабинет
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <PaymentForm orderId={orderId} />
      <div className="h-fit space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Ваш заказ</h2>
        <div className="space-y-2">
          {order.items?.map((oi) => (
            <div key={oi.id} className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {oi.title_snapshot} × {oi.quantity}
              </span>
              <span>
                {formatPrice(Number(oi.price_snapshot) * oi.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-3 font-semibold">
          <span>Итого:</span>
          <span>{formatPrice(Number(order.total))}</span>
        </div>
      </div>
    </div>
  )
}

function PayPage() {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 03 · Оплата
          </div>
          <h2>Оплата заказа</h2>
        </div>
      </header>
      <div className="frame py-8">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-none" />}>
          <PayContent />
        </Suspense>
      </div>
    </section>
  )
}
