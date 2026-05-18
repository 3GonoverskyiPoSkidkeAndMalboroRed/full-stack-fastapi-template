import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { AccountSettings } from "@/components/Account/AccountSettings"
import { OrdersList } from "@/components/Orders/OrdersList"
import { PendingOrders } from "@/components/Pending/PendingOrders"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WishlistList } from "@/components/Wishlist/WishlistList"

export const Route = createFileRoute("/_authed/account")({
  component: Account,
})

function Account() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Личный кабинет</h1>

      <Tabs defaultValue="orders" className="gap-6">
        <TabsList>
          <TabsTrigger value="orders">Мои заказы</TabsTrigger>
          <TabsTrigger value="wishlist">Избранное</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
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
  )
}
