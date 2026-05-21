import { createFileRoute, Outlet } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { PromoStrip } from "@/components/Common/PromoStrip"
import { PublicHeader } from "@/components/Common/PublicHeader"

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="bg-paper text-ink flex min-h-screen flex-col">
      <PromoStrip />
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
