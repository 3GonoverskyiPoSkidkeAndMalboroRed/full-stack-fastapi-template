import {
  Heart,
  Home,
  LogOut,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"

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
  const { user: currentUser, logout } = useAuth()

  const items: Item[] = currentUser?.is_superuser
    ? [
        { icon: ShoppingBag, title: "Каталог", path: "/catalog" },
        { icon: ShieldCheck, title: "Админка", path: "/admin" },
      ]
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Выйти" onClick={logout}>
              <LogOut />
              <span>Выйти</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
