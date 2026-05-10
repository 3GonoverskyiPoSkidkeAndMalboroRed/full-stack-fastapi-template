import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus } from "lucide-react"

import { cartUpdateCartItem } from "@/client"
import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface QuantityControlProps {
  cartItemId: string
  quantity: number
  maxQuantity?: number
}

export function QuantityControl({
  cartItemId,
  quantity,
  maxQuantity,
}: QuantityControlProps) {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (newQuantity: number) =>
      cartUpdateCartItem({
        path: { id: cartItemId },
        body: { quantity: newQuantity },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const decrement = () => {
    if (quantity > 1) mutation.mutate(quantity - 1)
  }
  const increment = () => {
    if (maxQuantity == null || quantity < maxQuantity) {
      mutation.mutate(quantity + 1)
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={decrement}
        disabled={mutation.isPending || quantity <= 1}
      >
        <Minus className="size-3" />
      </Button>
      <span className="w-8 text-center text-sm font-medium">{quantity}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={increment}
        disabled={
          mutation.isPending || (maxQuantity != null && quantity >= maxQuantity)
        }
      >
        <Plus className="size-3" />
      </Button>
    </div>
  )
}
