import { useSuspenseQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { itemsReadItems, sizesReadSizes } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddItem from "@/components/Items/AddItem"
import { columns } from "@/components/Items/columns"
import PendingItems from "@/components/Pending/PendingItems"
import AddSize from "@/components/Sizes/AddSize"
import { sizeColumns } from "@/components/Sizes/columns"
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

function ItemsTableContent() {
  const { data: items } = useSuspenseQuery(getItemsQueryOptions())

  if (items.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Нет товаров</h3>
        <p className="text-muted-foreground">Добавьте первый товар</p>
      </div>
    )
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
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Нет размеров</h3>
        <p className="text-muted-foreground">Добавьте размер</p>
      </div>
    )
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

export function ItemsAdminPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Товары</h2>
        <p className="text-sm text-muted-foreground">
          Управление товарами и каталогом размеров
        </p>
      </div>
      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Товары</TabsTrigger>
          <TabsTrigger value="sizes">Размеры</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
