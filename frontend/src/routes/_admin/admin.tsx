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

export const Route = createFileRoute("/_admin/admin")({
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
    meta: [{ title: "Админка — РЕЕСТР13" }],
  }),
})

function Admin() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const tab = search.tab ?? "users"

  return (
    <section>
      <header className="border-ink flex items-end justify-between gap-6 border-b px-6 pt-10 pb-5">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 99 · Системное
          </div>
          <h1 className="text-[40px] leading-none font-semibold tracking-[-0.02em]">
            Админка
          </h1>
        </div>
        <span className="text-muted-foreground hidden text-[13px] sm:inline">
          Управление пользователями, товарами и заказами
        </span>
      </header>

      <div className="px-6 py-8">
        <Tabs
          value={tab}
          onValueChange={(value) =>
            navigate({
              search: { tab: value as "users" | "items" | "orders" },
            })
          }
        >
          <TabsList className="border-ink h-auto gap-2 rounded-none border bg-transparent p-1">
            <TabsTrigger
              value="users"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Пользователи
            </TabsTrigger>
            <TabsTrigger
              value="items"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Товары
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-ink data-[state=active]:text-paper rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Заказы
            </TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <UsersAdminPanel />
          </TabsContent>
          <TabsContent value="items" className="mt-6">
            <ItemsAdminPanel />
          </TabsContent>
          <TabsContent value="orders" className="mt-6">
            <AdminOrdersPanel />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
