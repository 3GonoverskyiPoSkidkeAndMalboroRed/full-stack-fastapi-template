import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { CheckoutForm } from "@/components/Checkout/CheckoutForm"
import { OrderSummary } from "@/components/Checkout/OrderSummary"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_authed/checkout")({
  component: Checkout,
  head: () => ({ meta: [{ title: "Оформление — РЕЕСТР13" }] }),
})

function Checkout() {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 06 · Оплата
          </div>
          <h2>Оформление заказа</h2>
        </div>
      </header>
      <div className="frame grid gap-8 py-8 lg:grid-cols-[1fr_360px]">
        <CheckoutForm />
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-none" />}>
          <OrderSummary />
        </Suspense>
      </div>
    </section>
  )
}
