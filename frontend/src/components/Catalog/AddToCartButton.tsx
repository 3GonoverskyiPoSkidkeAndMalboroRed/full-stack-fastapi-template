import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Check, ShoppingCart } from "lucide-react"

import { cartAddCartItem, cartReadCart } from "@/client"
import { Button } from "@/components/ui/button"
import { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface AddToCartButtonProps {
  itemId: string
  quantity?: number
  disabled?: boolean
}

export function AddToCartButton({
  itemId,
  quantity = 1,
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

  const inCart = Boolean(cart?.data.find((c) => c.item_id === itemId))

  const mutation = useMutation({
    mutationFn: () => cartAddCartItem({ body: { item_id: itemId, quantity } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loggedIn) {
      navigate({ to: "/login" })
      return
    }
    mutation.mutate()
  }

  return (
    <Button
      type="button"
      variant={inCart ? "secondary" : "default"}
      onClick={handleClick}
      disabled={disabled || mutation.isPending}
      aria-pressed={inCart}
    >
      {inCart ? (
        <Check className="size-4" />
      ) : (
        <ShoppingCart className="size-4" />
      )}
      {inCart ? "В корзине" : "В корзину"}
    </Button>
  )
}
