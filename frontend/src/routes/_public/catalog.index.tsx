import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useMemo } from "react"
import { z } from "zod"

import {
  brandsReadBrandsPublic,
  categoriesReadCategoriesPublic,
  itemsReadItemsPublic,
  sizesReadSizeCountsPublic,
  sizesReadSizesPublic,
} from "@/client"
import { ProductGrid } from "@/components/Catalog/ProductGrid"
import {
  FilterCombobox,
  type FilterOption,
} from "@/components/Catalog/FilterCombobox"
import { PendingCatalog } from "@/components/Pending/PendingCatalog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SORT_VALUES = ["popular", "recent", "price_asc", "price_desc"] as const
type SortValue = (typeof SORT_VALUES)[number]

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "recent", label: "Сначала новые" },
  { value: "popular", label: "Сначала популярные" },
  { value: "price_asc", label: "Сначала дешёвые" },
  { value: "price_desc", label: "Сначала дорогие" },
]

const catalogSearchSchema = z.object({
  category_id: z.string().uuid().optional().catch(undefined),
  size_id: z.string().uuid().optional().catch(undefined),
  brand_id: z.string().uuid().optional().catch(undefined),
  sort: z.enum(SORT_VALUES).optional().catch(undefined),
})

type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const Route = createFileRoute("/_public/catalog/")({
  component: Catalog,
  head: () => ({ meta: [{ title: "Каталог — РЕЕСТР13" }] }),
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
          ...(search.brand_id ? { brand_id: search.brand_id } : {}),
          ...(search.sort ? { sort: search.sort } : {}),
        },
      })
      return res.data!
    },
  }
}

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

function CatalogContent() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(getCatalogQueryOptions(search))
  return (
    <>
      <CatalogMeta count={data.count} shown={data.data.length} />
      <ProductGrid items={data.data} columns={5} />
    </>
  )
}

function CatalogMeta({ count, shown }: { count: number; shown: number }) {
  return (
    <div className="sec-sub">
      <span className="text-ink">
        Показано {shown} из {count}
      </span>
      <span className="mono text-muted-foreground text-[11px] tracking-[0.06em]">
        ДРОП №04 · {new Date().getFullYear()}
      </span>
    </div>
  )
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
  const brandsQuery = useQuery({
    queryKey: ["brands", "public"],
    queryFn: async () => (await brandsReadBrandsPublic()).data!,
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

  const categoryOptions: FilterOption[] = useMemo(
    () =>
      (categoriesQuery.data?.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
      })),
    [categoriesQuery.data],
  )

  const sizeOptions: FilterOption[] = useMemo(
    () =>
      visibleSizes.map((s) => ({
        id: s.id,
        name: s.name,
        count: countsBySize.get(s.id) ?? 0,
      })),
    [visibleSizes, countsBySize],
  )

  const brandOptions: FilterOption[] = useMemo(
    () =>
      (brandsQuery.data?.data ?? []).map((b) => ({ id: b.id, name: b.name })),
    [brandsQuery.data],
  )

  const handleCategoryChange = (nextId: string | undefined) => {
    const nextName = nextId
      ? categoriesQuery.data?.data.find((c) => c.id === nextId)?.name
      : undefined
    const allowedSizes = filterSizesByCategoryName(
      sizesQuery.data?.data ?? [],
      nextName,
    )
    const sizeStillValid =
      search.size_id !== undefined &&
      allowedSizes.some((s) => s.id === search.size_id)

    navigate({
      search: (prev: CatalogSearch) => ({
        ...prev,
        category_id: nextId,
        size_id: sizeStillValid ? prev.size_id : undefined,
      }),
    })
  }

  const handleSizeChange = (nextId: string | undefined) => {
    navigate({
      search: (prev: CatalogSearch) => ({ ...prev, size_id: nextId }),
    })
  }

  const handleBrandChange = (nextId: string | undefined) => {
    navigate({
      search: (prev: CatalogSearch) => ({ ...prev, brand_id: nextId }),
    })
  }

  const handleSortChange = (next: SortValue) => {
    navigate({
      search: (prev: CatalogSearch) => ({
        ...prev,
        sort: next === "recent" ? undefined : next,
      }),
    })
  }

  return (
    <div className="border-ink flex flex-wrap items-center gap-3 border-b px-6 py-5">
      <FilterCombobox
        label="Категория"
        options={categoryOptions}
        value={search.category_id}
        onChange={handleCategoryChange}
        searchPlaceholder="Поиск категории…"
      />
      {visibleSizes.length > 0 && (
        <FilterCombobox
          label="Размер"
          options={sizeOptions}
          value={search.size_id}
          onChange={handleSizeChange}
          searchPlaceholder="Поиск размера…"
        />
      )}
      <FilterCombobox
        label="Бренд"
        options={brandOptions}
        value={search.brand_id}
        onChange={handleBrandChange}
        searchPlaceholder="Поиск бренда…"
      />
      <div className="w-full sm:ml-auto sm:w-72">
        <Select
          value={search.sort ?? "recent"}
          onValueChange={(value) => handleSortChange(value as SortValue)}
        >
          <SelectTrigger className="w-full">
            <span className="text-muted-foreground mr-1.5 shrink-0 text-[11px] tracking-[0.12em] whitespace-nowrap uppercase">
              Сортировка
            </span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
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
    <section>
      <header className="sec-head">
        <div>
          <div className="mono text-muted-foreground mb-3 text-[11px] tracking-[0.2em] uppercase">
            Раздел / 02 · Магазин
          </div>
          <h2>Каталог</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
            Все позиции
          </span>
          <span className="mono text-[12px] tracking-[0.08em]">ДРОП №04</span>
        </div>
      </header>
      <CatalogFilters />
      <Suspense fallback={<PendingCatalog />}>
        <CatalogContent />
      </Suspense>
    </section>
  )
}
