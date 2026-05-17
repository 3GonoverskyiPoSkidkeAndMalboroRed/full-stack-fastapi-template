import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

import {
  categoriesReadCategoriesPublic,
  type ItemPublic,
  sizesReadSizesPublic,
} from "@/client"
import { AddToCartButton } from "@/components/Catalog/AddToCartButton"
import { AddToWishlistButton } from "@/components/Catalog/AddToWishlistButton"
import { formatPrice } from "@/components/Catalog/ProductCard"
import { ProductGallery } from "@/components/Catalog/ProductGallery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface ProductDetailProps {
  item: ItemPublic
}

export function ProductDetail({ item }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1)
  const stock = item.stock ?? 0
  const outOfStock = stock <= 0

  const categoriesQuery = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async () => (await categoriesReadCategoriesPublic()).data!,
  })
  const sizesQuery = useQuery({
    queryKey: ["sizes", "public"],
    queryFn: async () => (await sizesReadSizesPublic()).data!,
  })

  const categoryName = item.category_id
    ? categoriesQuery.data?.data.find((c) => c.id === item.category_id)?.name
    : undefined
  const sizeName = item.size_id
    ? sizesQuery.data?.data.find((s) => s.id === item.size_id)?.name
    : undefined

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/catalog">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад в каталог
        </Link>
      </Button>
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={item.images ?? []} title={item.title} />
        <div className="flex flex-col gap-4">
          {item.brand && (
            <span className="text-muted-foreground text-sm tracking-wide uppercase">
              {item.brand}
            </span>
          )}
          <h1 className="text-3xl font-bold">{item.title}</h1>
          {(categoryName || sizeName) && (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {categoryName && <span>Категория: {categoryName}</span>}
              {sizeName && <span>Размер: {sizeName}</span>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold">
              {formatPrice(item.cost)}
            </span>
            {outOfStock ? (
              <Badge variant="secondary">Нет в наличии</Badge>
            ) : (
              <Badge variant="outline">В наличии: {stock}</Badge>
            )}
          </div>
          {item.description && (
            <p className="text-muted-foreground">{item.description}</p>
          )}
          {!outOfStock && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Количество</span>
              <div className="flex items-center gap-1 rounded-md border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </Button>
                <span className="w-10 text-center text-sm">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  disabled={quantity >= stock}
                >
                  +
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-4">
            <AddToCartButton
              itemId={item.id}
              quantity={quantity}
              disabled={outOfStock}
            />
            <AddToWishlistButton itemId={item.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
