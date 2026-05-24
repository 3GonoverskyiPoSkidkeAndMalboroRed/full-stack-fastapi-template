import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

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
            {outOfStock ? "Нет в наличии" : "В наличии"}
          </span>
          {item.brand && (
            <span className="mono text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
              {item.brand.name}
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AddToCartButton
            itemId={item.id}
            quantity={1}
            stock={stock}
            disabled={outOfStock}
          />
          <AddToWishlistButton itemId={item.id} />
        </div>
      </div>
    </section>
  )
}
