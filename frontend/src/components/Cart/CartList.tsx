import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { cartReadCart } from "@/client"
import { CartItemRow } from "@/components/Cart/CartItemRow"
import { formatPrice } from "@/components/Catalog/ProductCard"
import { Button } from "@/components/ui/button"

export function getCartQueryOptions() {
  return {
    queryKey: ["cart"],
    queryFn: async () => (await cartReadCart()).data!,
  }
}

export function CartList() {
  const { data } = useSuspenseQuery(getCartQueryOptions())

  if (data.count === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground mb-4">Корзина пуста.</p>
        <Button asChild>
          <Link to="/catalog">Перейти в каталог</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {data.data.map((ci) => (
          <CartItemRow key={ci.id} cartItem={ci} />
        ))}
      </div>
      <div className="h-fit space-y-4 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Итого</h2>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Товаров:</span>
          <span>{data.count}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-semibold">К оплате:</span>
          <span className="text-xl font-bold">
            {formatPrice(Number(data.subtotal))}
          </span>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link to="/checkout">Оформить заказ</Link>
        </Button>
      </div>
    </div>
  )
}
