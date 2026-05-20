import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ShoppingCart, Trash2 } from "lucide-react"

import { cartAddCartItem, cartDeleteCartItem, cartReadCart } from "@/client"
import { QuantityControl } from "@/components/Cart/QuantityControl"
import { Button } from "@/components/ui/button"
import { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface AddToCartButtonProps {
  itemId: string
  quantity?: number
  stock?: number
  disabled?: boolean
}

export function AddToCartButton({
  itemId,
  quantity = 1,
  stock,
  disabled = false,
}: AddToCartButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const loggedIn = isLoggedIn()

  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => (await cartReadCart()).data!,
    enabled: loggedIn,
  })

  const cartItem = cart?.data.find((c) => c.item_id === itemId)

  const addMutation = useMutation({
    mutationFn: () => cartAddCartItem({ body: { item_id: itemId, quantity } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: () => cartDeleteCartItem({ path: { id: cartItem?.id ?? "" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loggedIn) {
      navigate({ to: "/login" })
      return
    }
    addMutation.mutate()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteMutation.mutate()
  }

  if (cartItem) {
    return (
      <div
        className="inline-flex items-center gap-2"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <QuantityControl
          cartItemId={cartItem.id}
          quantity={cartItem.quantity ?? 1}
          maxQuantity={stock}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          aria-label="Удалить из корзины"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="default"
      onClick={handleAdd}
      disabled={disabled || addMutation.isPending}
    >
      <ShoppingCart className="size-4" />В корзину
    </Button>
  )
}
