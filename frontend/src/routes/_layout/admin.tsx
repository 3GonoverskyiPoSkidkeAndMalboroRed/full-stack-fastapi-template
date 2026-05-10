import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import { usersReadUserMe } from "@/client"
import { ItemsAdminPanel } from "@/components/Admin/ItemsAdminPanel"
import { AdminOrdersPanel } from "@/components/Admin/Orders/AdminOrdersPanel"
import { UsersAdminPanel } from "@/components/Admin/UsersAdminPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const adminSearchSchema = z
  .object({
    tab: z.enum(["users", "items", "orders"]).optional().catch(undefined),
  })
  .catch({})

type AdminSearch = z.infer<typeof adminSearchSchema>

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const res = await usersReadUserMe()
    if (!res.data?.is_superuser) {
      throw redirect({
        to: "/",
      })
    }
  },
  validateSearch: (search): AdminSearch =>
    adminSearchSchema.parse(search ?? {}),
  head: () => ({
    meta: [
      {
        title: "Admin - FastAPI Template",
      },
    ],
  }),
})

function Admin() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tab = search.tab ?? "users"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Админка</h1>
        <p className="text-muted-foreground">
          Управление пользователями, товарами и заказами
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({
            search: { tab: value as "users" | "items" | "orders" },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
          <TabsTrigger value="items">Товары</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UsersAdminPanel />
        </TabsContent>
        <TabsContent value="items" className="mt-4">
          <ItemsAdminPanel />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <AdminOrdersPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
