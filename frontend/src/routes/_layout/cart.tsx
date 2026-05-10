import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { CartList } from "@/components/Cart/CartList"
import { PendingCart } from "@/components/Pending/PendingCart"

export const Route = createFileRoute("/_layout/cart")({
  component: Cart,
})

function Cart() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Корзина</h1>
      <Suspense fallback={<PendingCart />}>
        <CartList />
      </Suspense>
    </div>
  )
}
