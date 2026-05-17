import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { CheckoutForm } from "@/components/Checkout/CheckoutForm"
import { OrderSummary } from "@/components/Checkout/OrderSummary"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_authed/checkout")({
  component: Checkout,
})

function Checkout() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Оформление заказа</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <CheckoutForm />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <OrderSummary />
        </Suspense>
      </div>
    </div>
  )
}
