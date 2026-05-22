import type { ItemPublic } from "@/client"
import { ProductCard } from "@/components/Catalog/ProductCard"

interface ProductGridProps {
  items: ItemPublic[]
  columns?: 3 | 4 | 5
}

export function ProductGrid({ items, columns = 5 }: ProductGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center">
        Товары не найдены.
      </p>
    )
  }

  const cols =
    columns === 5
      ? "xl:grid-cols-5"
      : columns === 4
        ? "xl:grid-cols-4"
        : "xl:grid-cols-3"

  return (
    <div
      className={`border-ink grid grid-cols-2 border-t border-l md:grid-cols-3 lg:grid-cols-4 ${cols}`}
    >
      {items.map((item, idx) => (
        <ProductCard key={item.id} item={item} index={idx} />
      ))}
    </div>
  )
}
