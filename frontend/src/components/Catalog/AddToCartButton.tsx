import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ShoppingCart } from "lucide-react"

import { cartAddCartItem } from "@/client"
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
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => cartAddCartItem({ body: { item_id: itemId, quantity } }),
    onSuccess: () => {
      showSuccessToast("Добавлено в корзину")
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleClick = () => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" })
      return
    }
    mutation.mutate()
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled || mutation.isPending}
    >
      <ShoppingCart className="size-4" />В корзину
    </Button>
  )
}
