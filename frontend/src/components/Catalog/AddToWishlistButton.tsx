import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Heart } from "lucide-react"

import {
  wishlistAddWishlistItem,
  wishlistDeleteWishlistItem,
  wishlistReadWishlist,
} from "@/client"
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
  const { showErrorToast } = useCustomToast()
  const loggedIn = isLoggedIn()

  const { data: wishlist } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => (await wishlistReadWishlist()).data!,
    enabled: loggedIn,
  })

  const wishlistItem = wishlist?.data.find((w) => w.item_id === itemId)
  const inWishlist = Boolean(wishlistItem)

  const addMutation = useMutation({
    mutationFn: () => wishlistAddWishlistItem({ body: { item_id: itemId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const removeMutation = useMutation({
    mutationFn: () => {
      if (!wishlistItem) {
        return Promise.reject(new Error("Запись не найдена"))
      }
      return wishlistDeleteWishlistItem({ path: { id: wishlistItem.id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const isPending = addMutation.isPending || removeMutation.isPending

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!loggedIn) {
      navigate({ to: "/login" })
      return
    }
    if (inWishlist) {
      removeMutation.mutate()
    } else {
      addMutation.mutate()
    }
  }

  const label = inWishlist ? "Убрать из избранного" : "В избранное"

  if (variant === "floating") {
    return (
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className={cn("size-8 rounded-full")}
        onClick={handleClick}
        disabled={isPending}
        aria-label={label}
        aria-pressed={inWishlist}
      >
        <Heart
          className={cn("size-4", inWishlist && "fill-current text-red-500")}
        />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={inWishlist ? "default" : "outline"}
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={inWishlist}
    >
      <Heart className={cn("size-4", inWishlist && "fill-current")} />
      {inWishlist ? "В избранном" : "В избранное"}
    </Button>
  )
}
