import { Link } from "@tanstack/react-router"

import type { ItemPublic } from "@/client"
import { AddToWishlistButton } from "@/components/Catalog/AddToWishlistButton"
import { formatPrice } from "@/lib/format"
import { firstPhotoOrPlaceholder } from "@/lib/photo"

interface ProductCardProps {
  item: ItemPublic
  index?: number
}

export function ProductCard({ item, index }: ProductCardProps) {
  const photo = firstPhotoOrPlaceholder(item.images)
  const hasPhoto = (item.images?.length ?? 0) > 0
  const outOfStock = (item.stock ?? 0) <= 0
  const number = String((index ?? 0) + 1).padStart(2, "0")

  return (
    <article className="border-ink group bg-paper relative flex flex-col gap-3 border-r border-b p-[18px]">
      <Link
        to="/catalog/$id"
        params={{ id: item.id }}
        className="bg-soft relative block aspect-square"
      >
        {hasPhoto ? (
          <img
            src={photo}
            alt={item.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="ph absolute inset-0 block">
            <span className="label">{number}</span>
          </span>
        )}
      </Link>

      <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <AddToWishlistButton itemId={item.id} variant="floating" />
      </div>

      <div className="flex items-start justify-between gap-2">
        <Link
          to="/catalog/$id"
          params={{ id: item.id }}
          className="text-[14px] leading-[1.25] font-medium tracking-[0.01em] hover:underline"
        >
          {item.title}
        </Link>
        <span className="mono text-muted-foreground text-[11px] tracking-[0.05em]">
          {number}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="mono text-[13px]">{formatPrice(item.cost)}</span>
        <span
          className={`text-[10px] tracking-[0.2em] uppercase ${
            outOfStock ? "text-[color:var(--accent)]" : "text-ink"
          }`}
        >
          {outOfStock ? "Sold out" : "In stock"}
        </span>
      </div>
    </article>
  )
}
