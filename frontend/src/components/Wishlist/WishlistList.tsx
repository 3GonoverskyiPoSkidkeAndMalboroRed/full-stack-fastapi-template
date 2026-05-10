import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { wishlistReadWishlist } from "@/client"
import { Button } from "@/components/ui/button"
import { WishlistItemRow } from "@/components/Wishlist/WishlistItemRow"

export function getWishlistQueryOptions() {
  return {
    queryKey: ["wishlist"],
    queryFn: async () => (await wishlistReadWishlist()).data!,
  }
}

export function WishlistList() {
  const { data } = useSuspenseQuery(getWishlistQueryOptions())

  if (data.count === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="mb-4 text-muted-foreground">В избранном пока пусто.</p>
        <Button asChild>
          <Link to="/catalog">Перейти в каталог</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.data.map((wi) => (
        <WishlistItemRow key={wi.id} wishlistItem={wi} />
      ))}
    </div>
  )
}
