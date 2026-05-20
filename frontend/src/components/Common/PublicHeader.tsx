import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { LogOut, ShoppingBag, ShoppingCart, User2 } from "lucide-react"

import { cartReadCart } from "@/client"
import { Logo } from "@/components/Common/Logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

export function PublicHeader() {
  const loggedIn = isLoggedIn()
  const { logout } = useAuth()

  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => (await cartReadCart()).data!,
    enabled: loggedIn,
  })
  const cartCount = cart?.count ?? 0

  return (
    <header className="bg-background sticky top-0 z-10 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Logo variant="full" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/catalog">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Каталог</span>
            </Link>
          </Button>
          {loggedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild className="relative">
                <Link to="/cart">
                  <span className="relative inline-flex">
                    <ShoppingCart className="size-4" />
                    {cartCount > 0 && (
                      <Badge
                        className="absolute -top-2 -right-2 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
                        variant="default"
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </Badge>
                    )}
                  </span>
                  <span className="hidden sm:inline">Корзина</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/account">
                  <User2 className="size-4" />
                  <span className="hidden sm:inline">Кабинет</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Выйти</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Войти</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Регистрация</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
