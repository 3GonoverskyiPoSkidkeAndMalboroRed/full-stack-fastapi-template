import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"

import { type CartItemPublic, cartDeleteCartItem } from "@/client"
import { QuantityControl } from "@/components/Cart/QuantityControl"
import { formatPrice } from "@/components/Catalog/ProductCard"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { firstPhotoOrPlaceholder } from "@/lib/photo"
import { handleError } from "@/utils"

interface CartItemRowProps {
  cartItem: CartItemPublic
}

export function CartItemRow({ cartItem }: CartItemRowProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const item = cartItem.item ?? null
  const imgSrc = firstPhotoOrPlaceholder(item?.images)
  const cost = item?.cost != null ? Number(item.cost) : 0
  const quantity = cartItem.quantity ?? 1
  const lineTotal = cost * quantity

  const deleteMutation = useMutation({
    mutationFn: () => cartDeleteCartItem({ path: { id: cartItem.id } }),
    onSuccess: () => {
      showSuccessToast("Товар удалён из корзины")
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center">
      <Link
        to="/catalog/$id"
        params={{ id: item?.id ?? cartItem.item_id }}
        className="bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md sm:size-20"
      >
        <img
          src={imgSrc}
          alt={item?.title ?? "товар"}
          className="size-20 object-cover"
        />
      </Link>
      <div className="flex-1 space-y-1">
        {item?.brand && (
          <span className="text-muted-foreground text-xs uppercase">
            {item.brand}
          </span>
        )}
        <Link
          to="/catalog/$id"
          params={{ id: item?.id ?? cartItem.item_id }}
          className="block font-medium hover:underline"
        >
          {item?.title ?? "Товар недоступен"}
        </Link>
        <span className="text-muted-foreground block text-sm">
          {formatPrice(cost)} × {quantity}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <QuantityControl
          cartItemId={cartItem.id}
          quantity={quantity}
          maxQuantity={item?.stock ?? undefined}
        />
        <span className="font-semibold">{formatPrice(lineTotal)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          aria-label="Удалить"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
