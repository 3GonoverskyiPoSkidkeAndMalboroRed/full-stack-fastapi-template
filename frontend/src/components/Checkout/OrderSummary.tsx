import { useSuspenseQuery } from "@tanstack/react-query"
import { getCartQueryOptions } from "@/components/Cart/CartList"
import { formatPrice } from "@/components/Catalog/ProductCard"

export function OrderSummary() {
  const { data } = useSuspenseQuery(getCartQueryOptions())

  return (
    <div className="rounded-md border p-4 space-y-3 h-fit">
      <h2 className="text-lg font-semibold">Ваш заказ</h2>
      <div className="space-y-2">
        {data.data.map((ci) => {
          const cost = ci.item?.cost != null ? Number(ci.item.cost) : 0
          const quantity = ci.quantity ?? 1
          return (
            <div
              key={ci.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="flex-1">
                <p className="font-medium line-clamp-1">
                  {ci.item?.title ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  {formatPrice(cost)} × {quantity}
                </p>
              </div>
              <span className="font-semibold">
                {formatPrice(cost * quantity)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <span className="font-semibold">Итого:</span>
        <span className="text-xl font-bold">
          {formatPrice(Number(data.subtotal))}
        </span>
      </div>
    </div>
  )
}
