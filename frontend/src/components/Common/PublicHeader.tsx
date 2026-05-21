import { useQuery } from "@tanstack/react-query"
import { Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"

import { cartReadCart } from "@/client"
import { Logo } from "@/components/Common/Logo"
import { SearchDialog } from "@/components/Common/SearchDialog"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

export function PublicHeader() {
  const loggedIn = isLoggedIn()
  const { logout } = useAuth()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => (await cartReadCart()).data!,
    enabled: loggedIn,
  })
  const cartCount = cart?.count ?? 0

  return (
    <header className="border-ink grid [grid-template-columns:200px_1fr_200px] items-center gap-6 border-b px-6 py-4 max-md:[grid-template-columns:auto_1fr_auto]">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="icon-btn"
          aria-label="Назад"
          onClick={() => router.history.back()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Поиск"
          onClick={() => setSearchOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-center gap-6 max-md:hidden">
        <Link to="/catalog" className="nav-link">
          Магазин
        </Link>
        <Logo variant="full" />
        {loggedIn ? (
          <Link to="/account" className="nav-link">
            Кабинет
          </Link>
        ) : (
          <Link to="/login" className="nav-link">
            Войти
          </Link>
        )}
      </div>

      <div className="flex items-center justify-end gap-4">
        <Link to={loggedIn ? "/cart" : "/login"} className="cart-pill">
          Корзина · {cartCount}
        </Link>
        {loggedIn && (
          <button
            type="button"
            onClick={logout}
            className="head-cta hidden md:inline-flex"
          >
            Выйти
          </button>
        )}
      </div>

      <div className="col-span-3 flex items-center justify-center gap-6 md:hidden">
        <Link to="/catalog" className="nav-link">
          Магазин
        </Link>
        <Logo variant="icon" />
        {loggedIn ? (
          <Link to="/account" className="nav-link">
            Кабинет
          </Link>
        ) : (
          <Link to="/login" className="nav-link">
            Войти
          </Link>
        )}
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
