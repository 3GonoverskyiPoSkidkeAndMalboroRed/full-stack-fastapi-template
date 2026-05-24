import { useSuspenseQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { brandsReadBrands, itemsReadItems, sizesReadSizes } from "@/client"
import AddBrand from "@/components/Brands/AddBrand"
import { brandColumns } from "@/components/Brands/columns"
import { DataTable } from "@/components/Common/DataTable"
import AddItem from "@/components/Items/AddItem"
import { columns } from "@/components/Items/columns"
import PendingItems from "@/components/Pending/PendingItems"
import AddSize from "@/components/Sizes/AddSize"
import { sizeColumns } from "@/components/Sizes/columns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function getItemsQueryOptions() {
  return {
    queryFn: async () => {
      const { data } = await itemsReadItems({ query: { skip: 0, limit: 100 } })
      return data!
    },
    queryKey: ["items"],
  }
}

function getSizesQueryOptions() {
  return {
    queryFn: async () => {
      const { data } = await sizesReadSizes({ query: { skip: 0, limit: 100 } })
      return data!
    },
    queryKey: ["sizes"],
  }
}

function getBrandsQueryOptions() {
  return {
    queryFn: async () => {
      const { data } = await brandsReadBrands({
        query: { skip: 0, limit: 100 },
      })
      return data!
    },
    queryKey: ["brands"],
  }
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <Search className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  )
}

function ItemsTableContent() {
  const { data: items } = useSuspenseQuery(getItemsQueryOptions())

  if (items.data.length === 0) {
    return <EmptyState title="Нет товаров" hint="Добавьте первый товар" />
  }

  return <DataTable columns={columns} data={items.data} />
}

function ItemsTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <ItemsTableContent />
    </Suspense>
  )
}

function SizesTableContent() {
  const { data: sizes } = useSuspenseQuery(getSizesQueryOptions())

  if (sizes.data.length === 0) {
    return <EmptyState title="Нет размеров" hint="Добавьте размер" />
  }

  return <DataTable columns={sizeColumns} data={sizes.data} />
}

function SizesTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <SizesTableContent />
    </Suspense>
  )
}

function BrandsTableContent() {
  const { data: brands } = useSuspenseQuery(getBrandsQueryOptions())

  if (brands.data.length === 0) {
    return <EmptyState title="Нет брендов" hint="Добавьте бренд" />
  }

  return <DataTable columns={brandColumns} data={brands.data} />
}

function BrandsTable() {
  return (
    <Suspense fallback={<PendingItems />}>
      <BrandsTableContent />
    </Suspense>
  )
}

function ItemsByBrandContent() {
  const { data: brands } = useSuspenseQuery(getBrandsQueryOptions())
  const { data: items } = useSuspenseQuery(getItemsQueryOptions())
  const [brandId, setBrandId] = useState<string | undefined>(undefined)

  const filteredItems = useMemo(() => {
    if (!brandId) return items.data
    return items.data.filter((item) => item.brand_id === brandId)
  }, [items.data, brandId])

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select
          value={brandId ?? "all"}
          onValueChange={(value) =>
            setBrandId(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Все бренды" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бренды</SelectItem>
            {brands.data.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filteredItems.length === 0 ? (
        <EmptyState title="Нет товаров" hint="Для этого бренда нет товаров" />
      ) : (
        <DataTable columns={columns} data={filteredItems} />
      )}
    </div>
  )
}

function ItemsByBrand() {
  return (
    <Suspense fallback={<PendingItems />}>
      <ItemsByBrandContent />
    </Suspense>
  )
}

export function ItemsAdminPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Товары</h2>
        <p className="text-muted-foreground text-sm">
          Управление товарами, размерами и брендами
        </p>
      </div>
      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Товары</TabsTrigger>
          <TabsTrigger value="sizes">Размеры</TabsTrigger>
          <TabsTrigger value="brands">Бренды</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="space-y-4">
          <div className="flex justify-end">
            <AddItem />
          </div>
          <ItemsTable />
        </TabsContent>
        <TabsContent value="sizes" className="space-y-4">
          <div className="flex justify-end">
            <AddSize />
          </div>
          <SizesTable />
        </TabsContent>
        <TabsContent value="brands" className="space-y-6">
          <div className="flex justify-end">
            <AddBrand />
          </div>
          <BrandsTable />
          <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight">
              Товары по бренду
            </h3>
            <ItemsByBrand />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
