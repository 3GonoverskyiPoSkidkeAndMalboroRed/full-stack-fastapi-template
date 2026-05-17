import { Link } from "@tanstack/react-router"
import { Heart, LogOut, ShoppingCart, User2 } from "lucide-react"

import { Logo } from "@/components/Common/Logo"
import { Button } from "@/components/ui/button"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

export function PublicHeader() {
  const loggedIn = isLoggedIn()
  const { logout } = useAuth()

  return (
    <header className="bg-background sticky top-0 z-10 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Logo variant="full" />
          <nav className="flex items-center gap-4">
            <Link
              to="/catalog"
              className="hover:text-foreground/80 text-sm font-medium"
              activeProps={{ className: "text-foreground" }}
            >
              Каталог
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/cart">
                  <ShoppingCart className="size-4" />
                  <span className="hidden sm:inline">Корзина</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/account" search={{ tab: "wishlist" }}>
                  <Heart className="size-4" />
                  <span className="hidden sm:inline">Избранное</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/account" search={{ tab: "orders" }}>
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
