import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Heart } from "lucide-react"

import { wishlistAddWishlistItem } from "@/client"
import { Button } from "@/components/ui/button"
import { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

interface AddToWishlistButtonProps {
  itemId: string
  variant?: "default" | "floating"
}

export function AddToWishlistButton({
  itemId,
  variant = "default",
}: AddToWishlistButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => wishlistAddWishlistItem({ body: { item_id: itemId } }),
    onSuccess: () => {
      showSuccessToast("Добавлено в избранное")
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn()) {
      navigate({ to: "/login" })
      return
    }
    mutation.mutate()
  }

  if (variant === "floating") {
    return (
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className={cn("size-8 rounded-full")}
        onClick={handleClick}
        disabled={mutation.isPending}
        aria-label="В избранное"
      >
        <Heart className="size-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={mutation.isPending}
    >
      <Heart className="size-4" />В избранное
    </Button>
  )
}
