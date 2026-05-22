import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { PromoStrip } from "@/components/Common/PromoStrip"
import { PublicHeader } from "@/components/Common/PublicHeader"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({ to: "/login" })
    }
  },
})

function AuthedLayout() {
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
