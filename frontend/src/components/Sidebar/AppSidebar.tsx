import {
  Heart,
  Home,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  User2,
} from "lucide-react"

import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Главная", path: "/" },
  { icon: ShoppingBag, title: "Каталог", path: "/catalog" },
  { icon: ShoppingCart, title: "Корзина", path: "/cart" },
  {
    icon: Heart,
    title: "Избранное",
    path: "/account",
    hash: "wishlist",
  },
  {
    icon: User2,
    title: "Кабинет",
    path: "/account",
  },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: ShieldCheck, title: "Админка", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
