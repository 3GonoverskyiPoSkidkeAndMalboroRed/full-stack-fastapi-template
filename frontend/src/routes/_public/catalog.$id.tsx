import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { itemsReadItemPublic } from "@/client"
import { ProductDetail } from "@/components/Catalog/ProductDetail"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_public/catalog/$id")({
  component: CatalogItem,
})

function getCatalogItemQueryOptions(id: string) {
  return {
    queryKey: ["catalog-item", id],
    queryFn: async () => {
      const res = await itemsReadItemPublic({ path: { id } })
      return res.data!
    },
  }
}

function CatalogItemContent() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(getCatalogItemQueryOptions(id))
  return <ProductDetail item={data} />
}

function PendingDetail() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

function CatalogItem() {
  return (
    <Suspense fallback={<PendingDetail />}>
      <CatalogItemContent />
    </Suspense>
  )
}
