import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { OrdersList } from "@/components/Orders/OrdersList"
import { PendingOrders } from "@/components/Pending/PendingOrders"
import { WishlistList } from "@/components/Wishlist/WishlistList"

export const Route = createFileRoute("/_authed/account")({
  component: Account,
})

function Account() {
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold">Личный кабинет</h1>

      <section id="orders" className="scroll-mt-20 space-y-4">
        <h2 className="text-2xl font-semibold">Мои заказы</h2>
        <Suspense fallback={<PendingOrders />}>
          <OrdersList />
        </Suspense>
      </section>

      <section id="wishlist" className="scroll-mt-20 space-y-4">
        <h2 className="text-2xl font-semibold">Избранное</h2>
        <Suspense fallback={<PendingOrders />}>
          <WishlistList />
        </Suspense>
      </section>
    </div>
  )
}
