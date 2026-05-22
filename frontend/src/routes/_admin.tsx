import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({ to: "/login" })
    }
  },
})

function AdminLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-paper">
        <header className="border-ink bg-paper sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <span className="mono text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
            РЕЕСТР13 / Админ-консоль
          </span>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
