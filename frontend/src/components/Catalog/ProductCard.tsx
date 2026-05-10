import { Link } from "@tanstack/react-router"
import { ShoppingCart } from "lucide-react"

import type { ItemPublic } from "@/client"
import { AddToWishlistButton } from "@/components/Catalog/AddToWishlistButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

interface ProductCardProps {
  item: ItemPublic
}

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/placeholder/600/600"

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
  const imgSrc = item.image_url || PLACEHOLDER_IMAGE
  const outOfStock = (item.stock ?? 0) <= 0

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <Link
        to="/catalog/$id"
        params={{ id: item.id }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={imgSrc}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute right-2 top-2">
          <AddToWishlistButton itemId={item.id} variant="floating" />
        </div>
        {outOfStock && (
          <Badge variant="secondary" className="absolute left-2 top-2">
            Нет в наличии
          </Badge>
        )}
      </Link>
      <CardContent className="flex flex-1 flex-col gap-2 px-4 py-3">
        {item.brand && (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
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
