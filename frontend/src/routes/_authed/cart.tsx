import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { CartList } from "@/components/Cart/CartList"
import { PendingCart } from "@/components/Pending/PendingCart"

export const Route = createFileRoute("/_authed/cart")({
  component: Cart,
  head: () => ({ meta: [{ title: "Корзина — РЕЕСТР13" }] }),
})

function Cart() {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 05 · Заказ
          </div>
          <h2>Корзина</h2>
        </div>
        <span className="mono text-muted-foreground text-[12px] tracking-[0.08em]">
          Доставка по РФ
        </span>
      </header>
      <div className="frame py-8">
        <Suspense fallback={<PendingCart />}>
          <CartList />
        </Suspense>
      </div>
    </section>
  )
}
