import type { ItemPublic } from "@/client"
import { ProductCard } from "@/components/Catalog/ProductCard"

interface ProductGridProps {
  items: ItemPublic[]
}

export function ProductGrid({ items }: ProductGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        Товары не найдены.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} />
      ))}
    </div>
  )
}
