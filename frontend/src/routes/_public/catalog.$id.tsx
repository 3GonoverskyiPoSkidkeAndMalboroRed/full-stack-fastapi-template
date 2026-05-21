import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { itemsReadItemPublic } from "@/client"
import { ProductDetail } from "@/components/Catalog/ProductDetail"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_public/catalog/$id")({
  component: CatalogItem,
  head: () => ({ meta: [{ title: "Товар — РЕЕСТР13" }] }),
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
    <section className="border-ink grid grid-cols-1 border-b lg:grid-cols-2">
      <div className="border-ink border-b p-6 lg:border-r lg:border-b-0">
        <Skeleton className="aspect-square w-full rounded-none" />
      </div>
      <div className="space-y-4 p-7">
        <Skeleton className="h-6 w-24 rounded-none" />
        <Skeleton className="h-12 w-3/4 rounded-none" />
        <Skeleton className="h-7 w-1/3 rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
      </div>
    </section>
  )
}

function CatalogItem() {
  return (
    <Suspense fallback={<PendingDetail />}>
      <CatalogItemContent />
    </Suspense>
  )
}
