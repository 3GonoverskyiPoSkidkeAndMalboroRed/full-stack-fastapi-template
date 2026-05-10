import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { z } from "zod"

import { OrdersList } from "@/components/Orders/OrdersList"
import { PendingOrders } from "@/components/Pending/PendingOrders"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WishlistList } from "@/components/Wishlist/WishlistList"

const tabSchema = z
  .object({
    tab: z.enum(["orders", "wishlist"]).optional().catch(undefined),
  })
  .catch({})

type AccountSearch = z.infer<typeof tabSchema>

export const Route = createFileRoute("/_layout/account")({
  component: Account,
  validateSearch: (search): AccountSearch => tabSchema.parse(search ?? {}),
})

function Account() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tab = search.tab ?? "orders"

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Личный кабинет</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({
            search: { tab: value as "orders" | "wishlist" },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="orders">Мои заказы</TabsTrigger>
          <TabsTrigger value="wishlist">Избранное</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <Suspense fallback={<PendingOrders />}>
            <OrdersList />
          </Suspense>
        </TabsContent>
        <TabsContent value="wishlist" className="mt-4">
          <Suspense fallback={<PendingOrders />}>
            <WishlistList />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
