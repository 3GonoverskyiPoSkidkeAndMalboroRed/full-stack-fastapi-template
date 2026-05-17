import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Trash2 } from "lucide-react"

import {
  cartAddCartItem,
  type WishlistItemPublic,
  wishlistDeleteWishlistItem,
} from "@/client"
import { formatPrice } from "@/components/Catalog/ProductCard"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { firstPhotoOrPlaceholder } from "@/lib/photo"
import { handleError } from "@/utils"

interface WishlistItemRowProps {
  wishlistItem: WishlistItemPublic
}

export function WishlistItemRow({ wishlistItem }: WishlistItemRowProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const item = wishlistItem.item ?? null
  const imgSrc = firstPhotoOrPlaceholder(item?.images)
  const outOfStock = (item?.stock ?? 0) <= 0

  const removeMutation = useMutation({
    mutationFn: () =>
      wishlistDeleteWishlistItem({ path: { id: wishlistItem.id } }),
    onSuccess: () => {
      showSuccessToast("Удалено из избранного")
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const addToCart = useMutation({
    mutationFn: () =>
      cartAddCartItem({
        body: { item_id: wishlistItem.item_id, quantity: 1 },
      }),
    onSuccess: () => {
      showSuccessToast("Добавлено в корзину")
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="flex items-center gap-4 rounded-md border p-4">
      <Link
        to="/catalog/$id"
        params={{ id: wishlistItem.item_id }}
        className="bg-muted overflow-hidden rounded-md"
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
          params={{ id: wishlistItem.item_id }}
          className="block font-medium hover:underline"
        >
          {item?.title ?? "Товар недоступен"}
        </Link>
        {item?.cost != null && (
          <span className="block text-sm font-semibold">
            {formatPrice(Number(item.cost))}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => addToCart.mutate()}
          disabled={outOfStock || addToCart.isPending}
        >
          В корзину
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          aria-label="Удалить"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
