import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { AccountSettings } from "@/components/Account/AccountSettings"
import { OrdersList } from "@/components/Orders/OrdersList"
import { PendingOrders } from "@/components/Pending/PendingOrders"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WishlistList } from "@/components/Wishlist/WishlistList"

export const Route = createFileRoute("/_authed/account")({
  component: Account,
  head: () => ({ meta: [{ title: "Кабинет — РЕЕСТР13" }] }),
})

function Account() {
  return (
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 04 · Аккаунт
          </div>
          <h2>Личный кабинет</h2>
        </div>
        <span className="mono text-muted-foreground text-[12px] tracking-[0.08em]">
          {new Date().toLocaleDateString("ru-RU")}
        </span>
      </header>

      <div className="frame py-8">
        <Tabs defaultValue="orders" className="gap-6">
          <TabsList className="border-ink h-auto gap-2 rounded-none border bg-transparent p-1">
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Мои заказы
            </TabsTrigger>
            <TabsTrigger
              value="wishlist"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Избранное
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Suspense fallback={<PendingOrders />}>
              <OrdersList />
            </Suspense>
          </TabsContent>

          <TabsContent value="wishlist" className="space-y-4">
            <Suspense fallback={<PendingOrders />}>
              <WishlistList />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
