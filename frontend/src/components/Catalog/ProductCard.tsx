import { Link } from "@tanstack/react-router"
import { ImagesIcon, ShoppingCart } from "lucide-react"

import type { ItemPublic } from "@/client"
import { AddToWishlistButton } from "@/components/Catalog/AddToWishlistButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { firstPhotoOrPlaceholder } from "@/lib/photo"

interface ProductCardProps {
  item: ItemPublic
}

function formatPrice(value?: string | number | null): string {
  if (value == null) return "—"
  const numeric = typeof value === "string" ? Number(value) : value
  if (Number.isNaN(numeric)) return "—"
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(numeric)
}

export function ProductCard({ item }: ProductCardProps) {
  const imgSrc = firstPhotoOrPlaceholder(item.images)
  const outOfStock = (item.stock ?? 0) <= 0
  const photoCount = item.images?.length ?? 0

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <Link
        to="/catalog/$id"
        params={{ id: item.id }}
        className="bg-muted relative block aspect-square overflow-hidden"
      >
        <img
          src={imgSrc}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute top-2 right-2">
          <AddToWishlistButton itemId={item.id} variant="floating" />
        </div>
        {outOfStock && (
          <Badge variant="secondary" className="absolute top-2 left-2">
            Нет в наличии
          </Badge>
        )}
        {photoCount > 1 && (
          <Badge variant="secondary" className="absolute bottom-2 left-2 gap-1">
            <ImagesIcon className="size-3" />
            {photoCount}
          </Badge>
        )}
      </Link>
      <CardContent className="flex flex-1 flex-col gap-2 px-4 py-3">
        {item.brand && (
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {item.brand}
          </span>
        )}
        <Link
          to="/catalog/$id"
          params={{ id: item.id }}
          className="line-clamp-2 text-sm font-medium hover:underline"
        >
          {item.title}
        </Link>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 px-4 pb-4">
        <span className="text-base font-semibold">
          {formatPrice(item.cost)}
        </span>
        <Button asChild size="sm">
          <Link to="/catalog/$id" params={{ id: item.id }}>
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline">Купить</span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export { formatPrice }
