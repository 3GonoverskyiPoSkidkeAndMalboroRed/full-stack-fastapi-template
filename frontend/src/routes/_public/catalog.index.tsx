import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useMemo } from "react"
import { z } from "zod"

import {
  categoriesReadCategoriesPublic,
  itemsReadItemsPublic,
  sizesReadSizeCountsPublic,
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

export const Route = createFileRoute("/_public/catalog/")({
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

const LETTER_SIZE = /^[A-Za-z]+$/
const NUMERIC_SIZE = /^\d+$/

function filterSizesByCategoryName<T extends { name: string }>(
  sizes: T[],
  categoryName: string | undefined,
): T[] {
  if (categoryName === "Одежда") {
    return sizes.filter((s) => LETTER_SIZE.test(s.name))
  }
  if (categoryName === "Обувь") {
    return sizes.filter((s) => NUMERIC_SIZE.test(s.name))
  }
  return sizes
}

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
  const sizeCountsQuery = useQuery({
    queryKey: ["sizes", "counts", search.category_id ?? null],
    queryFn: async () =>
      (
        await sizesReadSizeCountsPublic({
          query: search.category_id
            ? { category_id: search.category_id }
            : undefined,
        })
      ).data!,
  })

  const selectedCategoryName = useMemo(() => {
    if (!search.category_id) return undefined
    return categoriesQuery.data?.data.find((c) => c.id === search.category_id)
      ?.name
  }, [categoriesQuery.data, search.category_id])

  const countsBySize = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of sizeCountsQuery.data?.data ?? []) {
      map.set(row.size_id, row.count)
    }
    return map
  }, [sizeCountsQuery.data])

  const visibleSizes = useMemo(() => {
    const all = sizesQuery.data?.data ?? []
    return filterSizesByCategoryName(all, selectedCategoryName)
  }, [sizesQuery.data, selectedCategoryName])

  const handleCategoryChange = (value: string) => {
    const nextCategoryId = value === ALL_VALUE ? undefined : value
    const nextCategoryName = nextCategoryId
      ? categoriesQuery.data?.data.find((c) => c.id === nextCategoryId)?.name
      : undefined

    const allowedSizes = filterSizesByCategoryName(
      sizesQuery.data?.data ?? [],
      nextCategoryName,
    )
    const sizeStillValid =
      search.size_id !== undefined &&
      allowedSizes.some((s) => s.id === search.size_id)

    navigate({
      search: (prev: CatalogSearch) => ({
        ...prev,
        category_id: nextCategoryId,
        size_id: sizeStillValid ? prev.size_id : undefined,
      }),
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4 pb-6">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Категория</span>
        <Select
          value={search.category_id ?? ALL_VALUE}
          onValueChange={handleCategoryChange}
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
        <span className="text-muted-foreground text-xs">Размер</span>
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
            {visibleSizes.map((s) => {
              const count = countsBySize.get(s.id) ?? 0
              return (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {count}
                    </span>
                  </span>
                </SelectItem>
              )
            })}
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
