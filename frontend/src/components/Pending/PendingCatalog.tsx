import { Skeleton } from "@/components/ui/skeleton"

export function PendingCatalog() {
  return (
    <div className="border-ink grid grid-cols-2 border-t border-l md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="border-ink flex flex-col gap-3 border-r border-b p-[18px]"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <Skeleton className="h-4 w-3/4 rounded-none" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 rounded-none" />
            <Skeleton className="h-4 w-1/4 rounded-none" />
          </div>
        </div>
      ))}
    </div>
  )
}
