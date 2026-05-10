import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { z } from "zod"

import {
  categoriesReadCategoriesPublic,
  itemsReadItemsPublic,
  sizesReadSizesPublic,
} from "@/client"
import { ProductGrid } from "@/components/Catalog/ProductGrid"
import { PendingCatalog } from "@/components/Pending/PendingCatalog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const catalogSearchSchema = z.object({
  category_id: z.string().uuid().optional().catch(undefined),
  size_id: z.string().uuid().optional().catch(undefined),
})

type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const Route = createFileRoute("/_public/catalog")({
  component: Catalog,
  validateSearch: (search): CatalogSearch =>
    catalogSearchSchema.parse(search ?? {}),
})

function getCatalogQueryOptions(search: CatalogSearch) {
  return {
    queryKey: ["catalog", search],
    queryFn: async () => {
      const res = await itemsReadItemsPublic({
        query: {
          skip: 0,
          limit: 100,
          ...(search.category_id ? { category_id: search.category_id } : {}),
          ...(search.size_id ? { size_id: search.size_id } : {}),
        },
      })
      return res.data!
    },
  }
}

function CatalogContent() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(getCatalogQueryOptions(search))
  return <ProductGrid items={data.data} />
}

const ALL_VALUE = "__all__"

function CatalogFilters() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const categoriesQuery = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async () => (await categoriesReadCategoriesPublic()).data!,
  })
  const sizesQuery = useQuery({
    queryKey: ["sizes", "public"],
    queryFn: async () => (await sizesReadSizesPublic()).data!,
  })

  return (
    <div className="flex flex-wrap items-end gap-4 pb-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Категория</span>
        <Select
          value={search.category_id ?? ALL_VALUE}
          onValueChange={(value) =>
            navigate({
              search: (prev: CatalogSearch) => ({
                ...prev,
                category_id: value === ALL_VALUE ? undefined : value,
              }),
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Все категории</SelectItem>
            {categoriesQuery.data?.data.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Размер</span>
        <Select
          value={search.size_id ?? ALL_VALUE}
          onValueChange={(value) =>
            navigate({
              search: (prev: CatalogSearch) => ({
                ...prev,
                size_id: value === ALL_VALUE ? undefined : value,
              }),
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Все размеры" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Все размеры</SelectItem>
            {sizesQuery.data?.data.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function Catalog() {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Каталог</h1>
      <p className="text-muted-foreground">Все товары магазина</p>
      <CatalogFilters />
      <Suspense fallback={<PendingCatalog />}>
        <CatalogContent />
      </Suspense>
    </div>
  )
}
