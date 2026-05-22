import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import {
  categoriesReadCategoriesPublic,
  type ItemPublic,
  sizesReadSizesPublic,
} from "@/client"
import { AddToCartButton } from "@/components/Catalog/AddToCartButton"
import { AddToWishlistButton } from "@/components/Catalog/AddToWishlistButton"
import { ProductGallery } from "@/components/Catalog/ProductGallery"
import { formatPrice } from "@/lib/format"

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
    <section className="border-ink grid grid-cols-1 border-b lg:grid-cols-2">
      <div className="border-ink relative p-6 lg:border-r">
        <Link
          to="/catalog"
          className="upper text-muted-foreground mb-6 inline-flex items-center gap-2 text-[11px] tracking-[0.18em] hover:text-[color:var(--ink)]"
        >
          ← Назад в каталог
        </Link>
        <ProductGallery images={item.images ?? []} title={item.title} />
      </div>

      <div className="flex flex-col gap-6 p-7 lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <span className={`tag ${outOfStock ? "" : "solid"}`}>
            {outOfStock ? "Sold out" : "In stock"}
          </span>
          {item.brand && (
            <span className="mono text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
              {item.brand}
            </span>
          )}
        </div>

        <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.02em] text-balance md:text-[56px]">
          {item.title}
        </h1>

        <div className="border-ink flex items-end justify-between gap-4 border-b pb-5">
          <span className="mono text-[28px] leading-none">
            {formatPrice(item.cost)}
          </span>
          {!outOfStock && (
            <span className="mono text-muted-foreground text-[12px] tracking-[0.08em]">
              На складе · {stock}
            </span>
          )}
        </div>

        {(categoryName || sizeName) && (
          <dl className="border-ink/30 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed pb-4 text-[13px]">
            {categoryName && (
              <>
                <dt className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
                  Категория
                </dt>
                <dd className="text-right">{categoryName}</dd>
              </>
            )}
            {sizeName && (
              <>
                <dt className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
                  Размер
                </dt>
                <dd className="text-right">{sizeName}</dd>
              </>
            )}
          </dl>
        )}

        {item.description && (
          <p className="text-[15px] leading-[1.5]">{item.description}</p>
        )}

        {!outOfStock && (
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
              Количество
            </span>
            <div className="border-ink inline-flex items-center border">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="hover:bg-ink hover:text-paper h-9 w-9 transition-colors disabled:opacity-30"
              >
                −
              </button>
              <span className="mono w-12 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                disabled={quantity >= stock}
                className="hover:bg-ink hover:text-paper h-9 w-9 transition-colors disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AddToCartButton
            itemId={item.id}
            quantity={quantity}
            stock={stock}
            disabled={outOfStock}
          />
          <AddToWishlistButton itemId={item.id} />
        </div>
      </div>
    </section>
  )
}
